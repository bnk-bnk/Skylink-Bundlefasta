import { createClient } from '@supabase/supabase-js';
import { resolveConfig } from '../daraja/darajaClient';
import { DarajaService } from '../daraja/darajaService';
import { encryptInitiatorPassword } from '../b2cTopup/initiateB2CTopup';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface InitiateReversalParams {
  originalTxId: string; // Internal UUID or external Safaricom receipt ID
  amount: number;
  reason: string;
  userId?: string;
  receiverParty?: string;
  identifierType?: '1' | '2' | '4';
}

export async function initiateReversal(params: InitiateReversalParams) {
  const { originalTxId, amount, reason, userId, receiverParty, identifierType = '4' } = params;

  if (!originalTxId || !amount || !reason) {
    throw new Error('Original Transaction ID, Amount, and Reason are required.');
  }

  // 1. Find original transaction in the DB
  const cleanId = originalTxId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);

  let query = supabase.from('transactions').select('*');
  if (isUuid) {
    query = query.or(`id.eq.${cleanId},external_transaction_id.eq.${cleanId.toUpperCase()}`);
  } else {
    query = query.eq('external_transaction_id', cleanId.toUpperCase());
  }

  const { data: originalTx, error: findError } = await query.maybeSingle();

  if (findError) {
    console.error('[Reversal] Find original transaction error:', findError);
    throw new Error(`Failed to verify original transaction: ${findError.message}`);
  }

  if (!originalTx) {
    throw new Error('Original transaction not found. Please verify the ID or Receipt number.');
  }

  // Validate transaction state
  if (originalTx.status !== 'completed') {
    throw new Error(`Cannot reverse a transaction that is not completed (current status: ${originalTx.status}).`);
  }

  if (originalTx.transaction_type === 'REVERSAL') {
    throw new Error('Cannot reverse a transaction that is already of type REVERSAL.');
  }

  // Check if original transaction is already reversed (by checking existing completed reversals referencing this transaction)
  const originalReceipt = originalTx.external_transaction_id || originalTx.id;
  const { data: existingRev, error: checkError } = await supabase
    .from('reversal_queries')
    .select('id')
    .eq('status', 'completed')
    .eq('original_receipt', originalReceipt)
    .maybeSingle();

  if (checkError) {
    console.error('[Reversal] Check existing reversal error:', checkError);
    throw new Error(`Database verification failed: ${checkError.message}`);
  }

  if (existingRev) {
    throw new Error(`Duplicate Reversal Blocked: Transaction ${originalReceipt} has already been reversed.`);
  }

  // 2. Resolve configuration
  const config = await resolveConfig();
  const initiatorName = process.env.MPESA_INITIATOR_NAME || config.initiatorName || 'api_user';
  const initiatorPassword = process.env.MPESA_INITIATOR_PASSWORD || '';
  const securityCredential = initiatorPassword
    ? await encryptInitiatorPassword(initiatorPassword, config.env)
    : config.securityCredential || 'credential';

  // Receiver party is the shortcode initiating the reversal (our system's paybill/shortcode)
  const finalReceiverParty = receiverParty || config.shortCode || '174379';

  // 3. Create queued/pending query record in public.reversal_queries
  const { data: queryRecord, error: insertError } = await supabase
    .from('reversal_queries')
    .insert({
      original_transaction_id: originalTx.id,
      original_receipt: originalReceipt,
      amount: Number(amount),
      reason: reason,
      originator_conversation_id: 'pending',
      conversation_id: 'pending',
      status: 'pending',
      created_by: userId || null,
      raw_request: {
        Initiator: initiatorName,
        TransactionID: originalReceipt,
        Amount: Number(amount),
        ReceiverParty: finalReceiverParty,
        RecieverIdentifierType: identifierType,
        Remarks: reason
      }
    })
    .select()
    .single();

  if (insertError) {
    console.error('[Reversal] Database insert error:', insertError);
    throw new Error(`Failed to create reversal query record: ${insertError.message}`);
  }

  // 4. Log audit event
  await supabase.from('audit_logs').insert({
    user_id: userId || null,
    action: 'REVERSAL_INITIATED',
    entity_type: 'reversal_queries',
    entity_id: queryRecord.id,
    new_values: { 
      original_receipt: originalReceipt,
      amount: Number(amount),
      reason
    }
  });

  // 5. Submit to Safaricom Daraja API
  try {
    const callbackToken = process.env.MPESA_CALLBACK_TOKEN || 'skylink-default-secure-callback-token';
    const baseUrl = process.env.MPESA_CALLBACK_URL || '';
    
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const resultUrl = `${cleanBaseUrl}/api/webhooks/reversal/result?token=${callbackToken}`;
    const timeoutUrl = `${cleanBaseUrl}/api/webhooks/reversal/timeout?token=${callbackToken}`;

    const response = await DarajaService.requestReversal({
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      TransactionID: originalReceipt,
      Amount: Number(amount),
      ReceiverParty: finalReceiverParty,
      RecieverIdentifierType: identifierType,
      ResultURL: resultUrl,
      QueueTimeOutURL: timeoutUrl,
      Remarks: reason.substring(0, 100), // M-Pesa limit remarks to 100 chars
      Occasion: 'Reversal'
    });

    const isOk = response.ResponseCode === '0';
    const nextStatus = isOk ? 'processing' : 'failed';

    const { data: updatedRecord, error: updateError } = await supabase
      .from('reversal_queries')
      .update({
        status: nextStatus,
        conversation_id: response.ConversationID || 'failed',
        originator_conversation_id: response.OriginatorConversationID || 'failed',
        raw_response: response,
        updated_at: new Date().toISOString()
      })
      .eq('id', queryRecord.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return updatedRecord;

  } catch (err: any) {
    console.error('[Reversal API Error]', err);

    const { data: failedRecord } = await supabase
      .from('reversal_queries')
      .update({
        status: 'failed',
        conversation_id: 'error',
        originator_conversation_id: 'error',
        raw_response: { error: err.message || 'Immediate API Submission Failure' },
        updated_at: new Date().toISOString()
      })
      .eq('id', queryRecord.id)
      .select()
      .single();

    return failedRecord || queryRecord;
  }
}
