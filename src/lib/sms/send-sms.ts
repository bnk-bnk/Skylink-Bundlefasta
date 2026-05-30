import axios from 'axios';
import { createAdminClient } from '../supabase/server';
import { logSystemAudit } from '../repositories/audit';

interface SmsProviderConfig {
  apiKey: string;
  senderId: string;
}

/**
 * Dispatches SMS payload directly to BlazeTech Scope SMS API.
 */
export async function sendSmsViaProvider(
  phone: string,
  message: string,
  config: SmsProviderConfig
) {
  const url = 'https://sms.blazetechscope.com/v1/sendsms';

  const payload = {
    api_key: config.apiKey,
    apiKey: config.apiKey, // support multiple possible naming conventions
    sender_id: config.senderId,
    senderid: config.senderId,
    mobile: phone,
    phone: phone,
    message: message
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'x-api-key': config.apiKey
      },
      timeout: 30000 // 30 seconds timeout
    });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error: any) {
    console.error('[SMS Provider Error] Failed to send SMS:', error.response?.data || error.message);
    return {
      success: false,
      data: error.response?.data || null,
      error: error.message || 'Unknown network error'
    };
  }
}

/**
 * Background notification handler.
 * Analyzes transaction, formats template, queries database settings, executes SMS request, and records state.
 * Wraps all logic in a try/catch to never block the main checkout transaction.
 */
export async function triggerSmsNotification(tx: {
  direction: 'IN' | 'OUT';
  transaction_type: string;
  amount: number;
  account_reference: string | null;
  phone_number: string | null;
  mpesa_receipt: string | null;
}) {
  try {
    const adminSupabase = createAdminClient();

    // 1. Fetch SMS settings from database
    const { data: settings } = await adminSupabase
      .from('sms_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    // Resolve alert flags and credentials
    const incomingEnabled = settings ? settings.incoming_alerts_enabled : true;
    const outgoingEnabled = settings ? settings.outgoing_alerts_enabled : true;

    // Check if notification of this direction is disabled
    if (tx.direction === 'IN' && !incomingEnabled) {
      console.log('[SMS Alert] Incoming alerts disabled in settings. Skipping.');
      return;
    }
    if (tx.direction === 'OUT' && !outgoingEnabled) {
      console.log('[SMS Alert] Outgoing alerts disabled in settings. Skipping.');
      return;
    }

    const adminPhone = settings?.admin_alert_phone || process.env.ADMIN_ALERT_PHONE || '';
    const apiKey = process.env.SCOPE_SMS_API_KEY || '';
    const senderId = settings?.sender_id || process.env.SCOPE_SMS_SENDER_ID || '';

    if (!adminPhone) {
      console.warn('[SMS Alert] Admin alert phone number is not configured. Skipping SMS.');
      return;
    }

    if (!apiKey) {
      console.warn('[SMS Alert] SCOPE_SMS_API_KEY is not configured. Skipping SMS.');
      return;
    }

    // 2. Format SMS Message based on direction templates
    const timeStr = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    let messageBody = '';

    if (tx.direction === 'IN') {
      messageBody = `PAYBILL ALERT\nReceived KES ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}\nSource: ${tx.account_reference || 'Unknown'}\nPhone: ${tx.phone_number || 'Unknown'}\nReceipt: ${tx.mpesa_receipt || 'N/A'}\nTime: ${timeStr}`;
    } else {
      messageBody = `PAYBILL ALERT\nSent KES ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}\nType: ${tx.transaction_type}\nDestination: ${tx.phone_number || 'Unknown'}\nReference: ${tx.account_reference || 'N/A'}\nTime: ${timeStr}`;
    }

    // 3. Insert PENDING notification entry first
    const { data: dbNotification, error: insertErr } = await adminSupabase
      .from('sms_notifications')
      .insert({
        phone: adminPhone,
        message: messageBody,
        status: 'PENDING'
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[SMS Alert] Failed to insert pending notification log:', insertErr);
    }

    // 4. Send SMS
    const smsResult = await sendSmsViaProvider(adminPhone, messageBody, { apiKey, senderId });

    // Determine status and message details based on response
    let finalStatus = 'FAILED';
    let messageId = null;
    let errorMessage = smsResult.error || null;
    const responsePayload = smsResult.data;

    if (smsResult.success && responsePayload) {
      const responseCode = responsePayload['response-code'] || responsePayload.responseCode;
      const responseDescription = responsePayload['response-description'] || responsePayload.responseDescription;
      
      // Standard success codes
      if (responseCode === 200 || String(responseCode) === '200' || responseDescription === 'Success') {
        finalStatus = 'SENT';
        messageId = String(responsePayload.messageid || responsePayload.messageId || '');
      } else {
        errorMessage = responseDescription || 'Provider rejected request';
      }
    }

    // 5. Update database entry
    if (dbNotification) {
      await adminSupabase
        .from('sms_notifications')
        .update({
          status: finalStatus,
          message_id: messageId,
          provider_response: responsePayload,
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbNotification.id);
    }

    // 6. Log system audit
    if (finalStatus === 'SENT') {
      await logSystemAudit('SMS_SENT', {
        notificationId: dbNotification?.id,
        phone: adminPhone,
        messageId,
        receipt: tx.mpesa_receipt
      });
    } else {
      await logSystemAudit('SMS_FAILED', {
        notificationId: dbNotification?.id,
        phone: adminPhone,
        error: errorMessage,
        receipt: tx.mpesa_receipt
      });
    }
  } catch (err: any) {
    console.error('[SMS Service Error] Fatal error triggering SMS notification:', err);
    // Silent catch, never propagate SMS side-effect errors up to callers
  }
}
