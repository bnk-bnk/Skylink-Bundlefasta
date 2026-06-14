import crypto from 'crypto';
import { createAdminClient } from './supabase/server';
import { logSystemAudit } from './repositories/audit';

export async function sendPaybillWebhook(params: {
  event: 'activation' | 'withdrawal';
  transaction_id: string;
  amount: number;
  phone: string;
  platform: 'pesatrix';
  timestamp: string;
  reference_id: string;
  user_id: string;
  transaction_uuid?: string; // Optional internal UUID for notification_deliveries relation
}) {
  const url = process.env.PAYBILL_DASHBOARD_WEBHOOK_URL;
  const secret = process.env.PAYBILL_DASHBOARD_WEBHOOK_SECRET;

  const isProduction = process.env.NODE_ENV === 'production' || process.env.DARAJA_ENV === 'production';

  // Check if misconfigured
  if (!url || !secret) {
    const errMsg = 'Webhook URL or Secret key is not configured.';
    console.error(`[Webhook Export] ${errMsg}`);
    
    // In production, fail closed
    if (isProduction) {
      if (params.transaction_uuid) {
        const adminSupabase = createAdminClient();
        await adminSupabase.from('notification_deliveries').insert({
          transaction_id: params.transaction_uuid,
          notification_type: 'webhook_export',
          channel: 'webhook',
          recipient: url || 'unknown',
          message: JSON.stringify(params),
          deduplication_key: `webhook_export:${params.transaction_uuid}:${params.event}`,
          status: 'FAILED',
          error_message: errMsg,
          attempt_count: 1
        });
      }
      
      await logSystemAudit('WEBHOOK_EXPORT_FAILED', {
        event: params.event,
        transaction_id: params.transaction_id,
        reason: errMsg
      });
      
      throw new Error(errMsg);
    }
    
    console.warn(`[Webhook Export] Dev bypass: URL or secret is missing. Skipping webhook send.`);
    return { success: false, bypass: true };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (err: any) {
    const errMsg = `Invalid Webhook URL format: ${err.message}`;
    console.error(`[Webhook Export] ${errMsg}`);
    throw new Error(errMsg);
  }

  const payload = {
    event: params.event,
    transaction_id: params.transaction_id,
    amount: Number(params.amount),
    phone: params.phone,
    platform: params.platform,
    timestamp: params.timestamp,
    reference_id: params.reference_id,
    user_id: params.user_id
  };

  const payloadJson = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadJson, 'utf8')
    .digest('hex');

  const adminSupabase = createAdminClient();
  let dbDelivery: any = null;

  if (params.transaction_uuid) {
    const deduplicationKey = `webhook_export:${params.transaction_uuid}:${params.event}`;
    
    // Check if duplicate
    const { data: existing } = await adminSupabase
      .from('notification_deliveries')
      .select('id, status')
      .eq('deduplication_key', deduplicationKey)
      .maybeSingle();

    if (existing && existing.status === 'SENT') {
      console.log(`[Webhook Export] Webhook already sent successfully. Skipping.`);
      return { success: true, duplicate: true };
    }

    const { data, error } = await adminSupabase
      .from('notification_deliveries')
      .insert({
        transaction_id: params.transaction_uuid,
        notification_type: 'webhook_export',
        channel: 'webhook',
        recipient: url,
        message: payloadJson,
        deduplication_key: deduplicationKey,
        status: 'PENDING',
        attempt_count: 1
      })
      .select()
      .single();

    if (error) {
      console.error('[Webhook Export] Failed logging delivery outbox:', error);
    } else {
      dbDelivery = data;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pesatrix-Event': params.event,
        'X-Pesatrix-Signature': signature
      },
      body: payloadJson,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text();
    const isSuccess = response.status >= 200 && response.status < 300;

    if (dbDelivery) {
      await adminSupabase
        .from('notification_deliveries')
        .update({
          status: isSuccess ? 'SENT' : 'FAILED',
          provider_response: {
            status: response.status,
            body: responseBody
          },
          error_message: isSuccess ? null : `HTTP error: ${response.status} - ${responseBody}`,
          sent_at: isSuccess ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbDelivery.id);
    }

    if (!isSuccess) {
      throw new Error(`Failed to send webhook to Pesatrix application. Status: ${response.status}`);
    }

    await logSystemAudit('WEBHOOK_EXPORT_SUCCESS', {
      event: params.event,
      transaction_id: params.transaction_id,
      url
    });

    return { success: true };
  } catch (err: any) {
    console.error('[Webhook Export] Error sending webhook:', err);

    if (dbDelivery) {
      await adminSupabase
        .from('notification_deliveries')
        .update({
          status: 'FAILED',
          error_message: err.message || 'Network error',
          updated_at: new Date().toISOString()
        })
        .eq('id', dbDelivery.id);
    }

    await logSystemAudit('WEBHOOK_EXPORT_FAILED', {
      event: params.event,
      transaction_id: params.transaction_id,
      reason: err.message
    });

    throw err;
  }
}

export async function triggerPesatrixWebhookForTransaction(transactionId: string) {
  const adminSupabase = createAdminClient();

  const { data: tx, error } = await adminSupabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();

  if (error || !tx) {
    console.error(`[Webhook Trigger] Transaction ${transactionId} not found:`, error);
    return;
  }

  // Only trigger for pesatrix source system and successful status
  if (tx.source_system !== 'pesatrix' || tx.status !== 'SUCCESS') {
    return;
  }

  // Determine event type
  const event = tx.direction === 'IN' ? 'activation' : 'withdrawal';

  // Extract phone number
  const phone = tx.payer_phone || tx.recipient_phone || tx.phone_number || '';

  // Extract reference_id and user_id
  const reference_id = tx.external_reference_id || tx.account_reference || '';
  const user_id = tx.external_user_id || '';

  // Extract receipt / transaction_id
  const transaction_id = tx.receipt || tx.mpesa_receipt || '';

  if (!transaction_id) {
    console.warn(`[Webhook Trigger] Skipping webhook for transaction ${tx.id} due to missing receipt number.`);
    return;
  }

  try {
    await sendPaybillWebhook({
      event,
      transaction_id,
      amount: Number(tx.amount),
      phone,
      platform: 'pesatrix',
      timestamp: tx.occurred_at || tx.created_at || new Date().toISOString(),
      reference_id,
      user_id,
      transaction_uuid: tx.id
    });
  } catch (webhookErr) {
    console.error(`[Webhook Trigger] Failed exporting webhook for transaction ${tx.id}:`, webhookErr);
  }
}
