import { createClient } from '@supabase/supabase-js';
import { resolveConfig, getAccessToken } from '../daraja/darajaClient';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface STKSimulateParams {
  msisdn: string;            // Customer phone number (Safaricom MSISDN, e.g. 254712345678)
  amount: number;            // Amount to simulate
  billRefNumber: string;     // Account reference / BillRefNumber
  commandId?: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline'; // Defaults to CustomerPayBillOnline
  userId?: string;
}

export interface STKSimulateResult {
  success: boolean;
  responseCode: string;
  responseDescription: string;
  originatorConversationId?: string;
  conversationId?: string;
  rawResponse?: any;
  error?: string;
}

/**
 * Initiates an M-Pesa Express (STK Push) Simulate request.
 *
 * IMPORTANT: This API is SANDBOX ONLY. Calling it on a production environment
 * will result in an error from Safaricom. It simulates a C2B customer-initiated
 * payment to trigger the STK callback flow without an actual device prompt.
 *
 * Endpoint: POST https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate
 */
export async function initiateSTKSimulate(params: STKSimulateParams): Promise<STKSimulateResult> {
  const {
    msisdn,
    amount,
    billRefNumber,
    commandId = 'CustomerPayBillOnline',
    userId
  } = params;

  // 1. Load and validate Daraja config
  const config = await resolveConfig();

  if (config.env !== 'sandbox') {
    const errMsg = 'STK Push Simulate is a SANDBOX-ONLY API. It cannot be called in production.';
    console.error('[STK Simulate] Blocked:', errMsg);

    // Audit the blocked attempt
    await supabase.from('audit_logs').insert({
      action: 'STK_SIMULATE_BLOCKED_PRODUCTION',
      entity_type: 'integration',
      new_values: { reason: errMsg, requested_by: userId || 'unknown', msisdn, amount }
    }).catch(() => {});

    return { success: false, responseCode: 'ERR_PROD', responseDescription: errMsg, error: errMsg };
  }

  // 2. Normalize phone number to MSISDN format
  let normalizedPhone = msisdn.replace(/[^0-9]/g, '');
  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = '254' + normalizedPhone.substring(1);
  } else if (normalizedPhone.startsWith('7') || normalizedPhone.startsWith('1')) {
    normalizedPhone = '254' + normalizedPhone;
  }

  if (!/^254[17]\d{8}$/.test(normalizedPhone)) {
    return {
      success: false,
      responseCode: 'ERR_PHONE',
      responseDescription: 'Invalid phone number. Must be a valid Kenyan MSISDN (e.g. 254712345678).',
      error: 'Invalid MSISDN format.'
    };
  }

  // 3. Validate amount
  if (!amount || amount <= 0) {
    return { success: false, responseCode: 'ERR_AMOUNT', responseDescription: 'Amount must be greater than zero.', error: 'Invalid amount.' };
  }

  // 4. Fetch token and call Daraja Simulate endpoint
  try {
    const token = await getAccessToken(config);

    // Sandbox URL only
    const url = 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate';

    const payload = {
      ShortCode: config.shortCode,
      CommandID: commandId,
      Amount: amount,
      Msisdn: normalizedPhone,
      BillRefNumber: billRefNumber
    };

    console.log('[STK Simulate] Sending simulation payload:', { ...payload, Msisdn: '[MASKED]' });

    const apiStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    const apiDuration = Date.now() - apiStart;

    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // plaintext response
    }

    console.log(`[STK Simulate] Response (${apiDuration}ms):`, responseJson || responseText);

    const isSuccess = response.ok && (responseJson?.ResponseCode === '0' || responseJson?.errorCode === undefined);

    // 5. Audit the simulation attempt
    await supabase.from('audit_logs').insert({
      action: isSuccess ? 'STK_SIMULATE_SUCCESS' : 'STK_SIMULATE_FAILED',
      entity_type: 'integration',
      new_values: {
        msisdn: normalizedPhone,
        amount,
        billRefNumber,
        commandId,
        responseCode: responseJson?.ResponseCode,
        responseDescription: responseJson?.ResponseDescription,
        durationMs: apiDuration,
        requested_by: userId || 'unknown'
      }
    }).catch(() => {});

    return {
      success: isSuccess,
      responseCode: responseJson?.ResponseCode || response.status.toString(),
      responseDescription: responseJson?.ResponseDescription || responseText || 'No description returned.',
      originatorConversationId: responseJson?.OriginatorConversationID,
      conversationId: responseJson?.ConversationID,
      rawResponse: responseJson || responseText
    };

  } catch (err: any) {
    console.error('[STK Simulate] Error:', err);

    await supabase.from('audit_logs').insert({
      action: 'STK_SIMULATE_ERROR',
      entity_type: 'integration',
      new_values: { error: err.message, msisdn, amount, requested_by: userId || 'unknown' }
    }).catch(() => {});

    return {
      success: false,
      responseCode: 'ERR_EXCEPTION',
      responseDescription: err.message || 'Unexpected simulation error.',
      error: err.message
    };
  }
}
