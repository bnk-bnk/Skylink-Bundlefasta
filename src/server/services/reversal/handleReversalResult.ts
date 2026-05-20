import { createClient } from '@supabase/supabase-js';
import { parseReversalResult } from './parseReversalResult';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handleReversalResult(payload: any) {
  const result = payload?.Result;
  if (!result) {
    throw new Error('Invalid webhook payload: Missing Result');
  }

  const conversationId = result.ConversationID;
  const originatorConversationId = result.OriginatorConversationID;

  if (!conversationId) {
    throw new Error('Invalid webhook payload: Missing ConversationID');
  }

  // 1. Fetch query record from reversal_queries
  const { data: queryRecord, error: findError } = await supabase
    .from('reversal_queries')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (findError) {
    console.error('[ReversalCallback] Query retrieval failed:', findError);
    throw new Error(`Failed to find reversal query record: ${findError.message}`);
  }

  if (!queryRecord) {
    console.warn(`[ReversalCallback] No matching reversal query found for ConversationID: ${conversationId}`);
    return { status: 'not_found', conversationId };
  }

  // 2. Idempotency Check: Ignore if already processed
  if (['completed', 'failed', 'timeout'].includes(queryRecord.status)) {
    console.warn(`[ReversalCallback] Duplicate callback ignored. Query ${queryRecord.id} is already in status: ${queryRecord.status}`);
    return { status: 'ignored', queryId: queryRecord.id };
  }

  // Parse result parameters
  const parsed = parseReversalResult(payload);
  const isTxSuccess = parsed.resultCode === '0';
  const nextStatus = isTxSuccess ? 'completed' : 'failed';

  // 3. Update query log with callback details
  const { error: updateError } = await supabase
    .from('reversal_queries')
    .update({
      status: nextStatus,
      raw_result: payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', queryRecord.id);

  if (updateError) {
    console.error('[ReversalCallback] Failed to update query status:', updateError);
    throw updateError;
  }

  // 4. Retrieve original transaction
  const { data: originalTx, error: origTxError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', queryRecord.original_transaction_id)
    .single();

  if (origTxError) {
    console.error('[ReversalCallback] Failed to fetch original transaction:', origTxError);
  }

  let alertMessage = '';

  if (isTxSuccess && originalTx) {
    const originalReceipt = originalTx.external_transaction_id || originalTx.id;
    const reversalReceipt = parsed.reversalReceipt || `REV-${originalReceipt}`;

    // 5. Insert new Reversal Transaction
    const { data: revTx, error: revTxError } = await supabase
      .from('transactions')
      .insert({
        customer_id: originalTx.customer_id,
        transaction_type: 'REVERSAL',
        direction: originalTx.direction === 'incoming' ? 'outgoing' : 'incoming',
        provider: 'mpesa',
        external_transaction_id: reversalReceipt,
        reference: originalReceipt,
        account_reference: originalTx.account_reference,
        phone_number: originalTx.phone_number,
        amount: Number(queryRecord.amount),
        commission_amount: 0,
        processing_fee: 0,
        currency: originalTx.currency,
        status: 'completed',
        occurred_at: new Date().toISOString(),
        result_code: parsed.resultCode,
        result_desc: parsed.resultDesc
      })
      .select()
      .single();

    if (revTxError) {
      console.error('[ReversalCallback] Failed to insert reversal transaction:', revTxError);
    } else if (revTx) {
      // 6. Double Entry Ledger adjustment
      // Fetch ledger entries for original transaction
      const { data: originalLedger, error: ledgerFetchError } = await supabase
        .from('ledger_entries')
        .select('account_id, entry_type, amount')
        .eq('transaction_id', originalTx.id);

      if (ledgerFetchError) {
        console.error('[ReversalCallback] Failed to retrieve original ledger entries:', ledgerFetchError);
      }

      if (originalLedger && originalLedger.length > 0) {
        // Reverse original entries (DEBIT becomes CREDIT, CREDIT becomes DEBIT)
        const reversedEntries = originalLedger.map(entry => ({
          transaction_id: revTx.id,
          account_id: entry.account_id,
          entry_type: entry.entry_type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
          amount: entry.amount
        }));

        const { error: ledgerInsertError } = await supabase
          .from('ledger_entries')
          .insert(reversedEntries);

        if (ledgerInsertError) {
          console.error('[ReversalCallback] Ledger entry inversion failed:', ledgerInsertError);
        }
      } else {
        // Fallback: DEBIT Disbursements Vault, CREDIT Paybill Collection Main
        const { error: fallbackLedgerErr } = await supabase
          .from('ledger_entries')
          .insert([
            {
              transaction_id: revTx.id,
              account_id: 'a3333333-3333-3333-3333-333333333333', // Disbursements Vault
              entry_type: 'DEBIT',
              amount: Number(queryRecord.amount)
            },
            {
              transaction_id: revTx.id,
              account_id: 'a1111111-1111-1111-1111-111111111111', // Paybill Collection Main
              entry_type: 'CREDIT',
              amount: Number(queryRecord.amount)
            }
          ]);

        if (fallbackLedgerErr) {
          console.error('[ReversalCallback] Fallback ledger insertion failed:', fallbackLedgerErr);
        }
      }

      // 7. Write Audit Log
      await supabase.from('audit_logs').insert({
        user_id: queryRecord.created_by || null,
        action: 'REVERSAL_COMPLETED',
        entity_type: 'transactions',
        entity_id: revTx.id,
        old_values: { original_transaction_id: originalTx.id, amount: originalTx.amount },
        new_values: { reason: queryRecord.reason, reversal_receipt: reversalReceipt },
        ip_address: 'webhook'
      });

      alertMessage = `Reversal successful for ${originalReceipt}. Reversal Receipt: ${reversalReceipt}.`;
    }
  } else {
    // Reversal failed
    const originalReceipt = originalTx?.external_transaction_id || 'unknown';
    alertMessage = `Reversal failed for ${originalReceipt}. Reason: ${parsed.resultDesc || 'M-Pesa Rejected'}`;

    // Write Audit Log for failure
    await supabase.from('audit_logs').insert({
      user_id: queryRecord.created_by || null,
      action: 'REVERSAL_FAILED',
      entity_type: 'reversal_queries',
      entity_id: queryRecord.id,
      new_values: { 
        original_receipt: originalReceipt,
        result_code: parsed.resultCode,
        result_desc: parsed.resultDesc
      },
      ip_address: 'webhook'
    });
  }

  // 8. Create real-time notification
  await supabase.from('notifications').insert({
    user_id: queryRecord.created_by || null,
    title: isTxSuccess ? 'Reversal Completed' : 'Reversal Failed',
    message: alertMessage,
    type: isTxSuccess ? 'success' : 'error',
    read: false
  });

  return { status: nextStatus, queryId: queryRecord.id };
}
