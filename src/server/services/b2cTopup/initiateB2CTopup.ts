import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { resolveConfig, getAccessToken } from '../daraja/darajaClient';
import { validateB2CTopup } from './validateB2CTopup';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

let sandboxCertCache: Buffer | null = null;

/**
 * Dynamically retrieves the Safaricom public certificate and encrypts the initiator password.
 */
export async function encryptInitiatorPassword(password: string, env: 'sandbox' | 'production'): Promise<string> {
  let certBuffer: Buffer;
  
  if (env === 'sandbox') {
    if (sandboxCertCache) {
      certBuffer = sandboxCertCache;
    } else {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout
        const certRes = await fetch('https://developer.safaricom.co.ke/sites/default/files/cert/cert_sandbox/cert.cer', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (certRes.ok) {
          const ab = await certRes.arrayBuffer();
          certBuffer = Buffer.from(ab);
          sandboxCertCache = certBuffer; // Cache it
        } else {
          throw new Error(`HTTP status ${certRes.status}`);
        }
      } catch (fetchErr) {
        console.warn('[Daraja B2C Encrypt] Failed to fetch sandbox certificate from Safaricom. Falling back to env MPESA_SECURITY_CREDENTIAL.', fetchErr);
        return process.env.MPESA_SECURITY_CREDENTIAL || 'credential';
      }
    }
  } else {
    // Production
    const prodCertPem = process.env.MPESA_PUBLIC_CERTIFICATE_PEM;
    if (!prodCertPem) {
      console.warn('[Daraja B2C Encrypt] MPESA_PUBLIC_CERTIFICATE_PEM env is missing. Falling back to MPESA_SECURITY_CREDENTIAL.');
      return process.env.MPESA_SECURITY_CREDENTIAL || 'credential';
    }
    certBuffer = Buffer.from(prodCertPem, 'utf-8');
  }

  try {
    const publicKey = crypto.createPublicKey({
      key: certBuffer,
      format: certBuffer.toString().includes('-----BEGIN') ? 'pem' : 'der',
      type: 'spki'
    });
    
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(password)
    );
    return encrypted.toString('base64');
  } catch (err: any) {
    console.error('[Daraja B2C Encrypt] Encryption failed:', err);
    throw new Error(`Initiator password encryption failed: ${err.message}`);
  }
}

export interface InitiateTopupParams {
  destinationShortcode: string;
  amount: number;
  accountReference: string;
  remarks: string;
  requesterPhone?: string;
  confirmationPassword?: string;
  userId?: string;
  parentTransactionId?: string; // Links retries
}

export async function initiateB2CTopup(params: InitiateTopupParams) {
  const {
    destinationShortcode,
    amount,
    accountReference,
    remarks,
    requesterPhone = '',
    confirmationPassword,
    userId,
    parentTransactionId
  } = params;

  // 1. Generate unique internal reference UUID
  const internalReference = crypto.randomUUID();

  // 2. Validate input and safety checks (limits, daily limit, cooldown)
  const validation = await validateB2CTopup({
    amount,
    destinationShortcode,
    confirmationPassword
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Validation failed');
  }

  // 3. Resolve configs and create queued row
  const config = await resolveConfig();
  const initiatorName = process.env.MPESA_INITIATOR_NAME || config.initiatorName || 'api_user';
  const sourceShortcode = config.shortCode || '174379';

  // Determine retry count
  let retryCount = 0;
  if (parentTransactionId) {
    const { data: parent } = await supabase
      .from('b2c_account_topups')
      .select('retry_count')
      .eq('id', parentTransactionId)
      .maybeSingle();
    retryCount = (parent?.retry_count || 0) + 1;
  }

  const { data: trx, error: insertError } = await supabase
    .from('b2c_account_topups')
    .insert({
      internal_reference: internalReference,
      parent_transaction_id: parentTransactionId || null,
      initiator_name: initiatorName,
      source_shortcode: sourceShortcode,
      destination_shortcode: destinationShortcode,
      sender_identifier_type: '4',
      receiver_identifier_type: '4', // Shortcode to Shortcode
      requester_phone: requesterPhone || null,
      account_reference: accountReference,
      remarks: remarks,
      amount: amount,
      currency: 'KES',
      status: 'queued',
      created_by: userId || null,
      retry_count: retryCount
    })
    .select()
    .single();

  if (insertError) {
    console.error('[B2C Topup] Insert error:', insertError);
    throw new Error(`Failed to create transaction record: ${insertError.message}`);
  }

  // Audit topup creation
  await supabase.from('treasury_audit_logs').insert({
    topup_id: trx.id,
    action: 'topup_created',
    metadata: { internal_reference: internalReference, amount, destinationShortcode, parent_transaction_id: parentTransactionId || null }
  });

  // 4. Submit to Daraja B2B API
  try {
    // Transition status to submitted
    await supabase
      .from('b2c_account_topups')
      .update({ status: 'submitted', raw_request: { timestamp: new Date().toISOString() } })
      .eq('id', trx.id);

    await supabase.from('treasury_audit_logs').insert({
      topup_id: trx.id,
      action: 'topup_submitted'
    });

    // Encrypt initiator password dynamically
    const initiatorPassword = process.env.MPESA_INITIATOR_PASSWORD || '';
    const securityCredential = initiatorPassword 
      ? await encryptInitiatorPassword(initiatorPassword, config.env)
      : config.securityCredential || 'credential';

    const token = await getAccessToken(config);
    const url = 'https://api.safaricom.co.ke/mpesa/b2b/v1/paymentrequest';

    const b2bResultUrl = process.env.MPESA_B2B_TOPUP_RESULT_URL || process.env.MPESA_B2B_RESULT_URL || config.callbackUrl;
    const b2bTimeoutUrl = process.env.MPESA_B2B_TOPUP_TIMEOUT_URL || process.env.MPESA_B2B_TIMEOUT_URL || config.callbackUrl;

    const payload = {
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'BusinessPayToBulk', // B2C Float Load command ID
      SenderIdentifierType: '4',
      RecieverIdentifierType: '4',
      Amount: amount,
      PartyA: sourceShortcode,
      PartyB: destinationShortcode,
      AccountReference: accountReference,
      Remarks: remarks,
      QueueTimeOutURL: b2bTimeoutUrl,
      ResultURL: b2bResultUrl
    };

    const apiStart = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {}

    const apiDuration = Date.now() - apiStart;
    const isOk = response.ok && responseJson?.ResponseCode === '0';
    const nextStatus = isOk ? 'processing' : 'failed';

    const { data: updatedTrx, error: updateError } = await supabase
      .from('b2c_account_topups')
      .update({
        status: nextStatus,
        conversation_id: responseJson?.ConversationID || null,
        originator_conversation_id: responseJson?.OriginatorConversationID || null,
        result_code: responseJson?.ResponseCode || response.status.toString(),
        result_description: responseJson?.ResponseDescription || responseText || 'No response details',
        raw_response: {
          statusCode: response.status,
          body: responseJson || responseText,
          durationMs: apiDuration
        }
      })
      .eq('id', trx.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log submitted/failed result
    await supabase.from('treasury_audit_logs').insert({
      topup_id: trx.id,
      action: isOk ? 'topup_submitted_success' : 'topup_failed',
      metadata: { response: responseJson || responseText }
    });

    return updatedTrx;

  } catch (err: any) {
    console.error('[B2C Topup API Submission Error]', err);

    const { data: failedTrx } = await supabase
      .from('b2c_account_topups')
      .update({
        status: 'failed',
        result_description: err.message || 'Immediate API Submission Failure',
        raw_response: { error: err.message }
      })
      .eq('id', trx.id)
      .select()
      .single();

    await supabase.from('treasury_audit_logs').insert({
      topup_id: trx.id,
      action: 'topup_failed',
      metadata: { error: err.message }
    });

    return failedTrx || trx;
  }
}
