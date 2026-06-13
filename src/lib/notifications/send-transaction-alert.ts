import { createAdminClient } from '../supabase/server';
import { logSystemAudit } from '../repositories/audit';
import { sendScopeSms } from './providers/scope-sms';
import { sendEvolutionWhatsApp } from './providers/evolution-whatsapp';
import { getReadableLabel } from '../utils/labels';

interface AlertParams {
  transaction_id: string;
  webhook_event_id?: string | null;
  source_system: string;
  direction: 'IN' | 'OUT';
  transaction_type: string;
  amount: number;
  account_reference?: string | null;
  phone_number?: string | null;
  mpesa_receipt?: string | null;
  module?: string | null;
}

/**
 * Builds the notification text body based on the channel and direction.
 */
export function buildAlertMessage(params: AlertParams, channel: 'sms' | 'whatsapp'): string {
  const timeStr = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
  const formattedAmount = params.amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const readableSource = getReadableLabel(params.source_system);
  const readableType = getReadableLabel(params.transaction_type);
  const readableModule = getReadableLabel(params.module);

  if (channel === 'sms') {
    if (params.direction === 'IN') {
      const lines = [
        'SKYLINK PAYBILL',
        `Received KES ${formattedAmount}`,
        `Source: ${readableSource}`
      ];
      if (params.module) lines.push(`Module: ${readableModule}`);
      lines.push(`Type: ${readableType}`);
      if (params.phone_number) lines.push(`Phone: ${params.phone_number}`);
      if (params.mpesa_receipt) lines.push(`Receipt: ${params.mpesa_receipt}`);
      lines.push(`Time: ${timeStr}`);
      return lines.join('\n');
    } else {
      const lines = [
        'SKYLINK PAYBILL',
        `Sent KES ${formattedAmount}`,
        `Source: ${readableSource}`,
        `Type: ${readableType}`
      ];
      if (params.phone_number) lines.push(`To: ${params.phone_number}`);
      if (params.mpesa_receipt || params.account_reference) {
        lines.push(`Ref: ${params.mpesa_receipt || params.account_reference}`);
      }
      lines.push(`Time: ${timeStr}`);
      return lines.join('\n');
    }
  } else {
    // WhatsApp formatting (uses bold markdown syntax)
    if (params.direction === 'IN') {
      const lines = [
        '*SKYLINK PAYBILL ALERT*',
        '',
        `Money received: *KES ${formattedAmount}*`,
        `Source: ${readableSource}`
      ];
      if (params.module) lines.push(`Module: ${readableModule}`);
      lines.push(`Type: ${readableType}`);
      if (params.phone_number) lines.push(`From: ${params.phone_number}`);
      if (params.account_reference) lines.push(`Account: ${params.account_reference}`);
      if (params.mpesa_receipt) lines.push(`Receipt: ${params.mpesa_receipt}`);
      lines.push(`Time: ${timeStr}`);
      return lines.join('\n');
    } else {
      const lines = [
        '*SKYLINK PAYBILL ALERT*',
        '',
        `Money sent: *KES ${formattedAmount}*`,
        `Source: ${readableSource}`,
        `Type: ${readableType}`
      ];
      if (params.phone_number) lines.push(`To: ${params.phone_number}`);
      if (params.mpesa_receipt || params.account_reference) {
        lines.push(`Reference: ${params.mpesa_receipt || params.account_reference}`);
      }
      lines.push(`Time: ${timeStr}`);
      return lines.join('\n');
    }
  }
}

/**
 * Triggers the end-to-end alert flow: checks settings, format, deduplicate, dispatch, and log audits.
 */
export async function triggerNotificationFlow(params: AlertParams) {
  try {
    const adminSupabase = createAdminClient();

    // 1. Fetch alert preferences from the settings table
    const { data: settings } = await adminSupabase
      .from('sms_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    const incomingEnabled = settings ? settings.incoming_alerts_enabled : true;
    const outgoingEnabled = settings ? settings.outgoing_alerts_enabled : true;
    const channel = (settings?.notification_channel || 'sms') as 'sms' | 'whatsapp';
    const recipientPhone = settings?.admin_alert_phone || process.env.ADMIN_ALERT_PHONE || '';

    // Check alert toggles
    if (params.direction === 'IN' && !incomingEnabled) {
      console.log('[Notification Alert] Incoming alerts disabled in preferences. Skipping.');
      return;
    }
    if (params.direction === 'OUT' && !outgoingEnabled) {
      console.log('[Notification Alert] Outgoing alerts disabled in preferences. Skipping.');
      return;
    }

    if (!recipientPhone) {
      console.warn('[Notification Alert] Recipient phone number not configured. Skipping alert.');
      return;
    }

    // 2. Compute deduplication key
    const deduplicationKey = `transaction:${params.transaction_id}:${params.direction.toLowerCase()}-alert:${channel}`;

    // 3. Check if notification has already been processed (Idempotency)
    const { data: existingDelivery } = await adminSupabase
      .from('notification_deliveries')
      .select('id, status')
      .eq('deduplication_key', deduplicationKey)
      .maybeSingle();

    if (existingDelivery) {
      console.log(`[Notification Alert] Delivery already exists (Status: ${existingDelivery.status}). Skipping.`);
      return;
    }

    // 4. Build message
    const message = buildAlertMessage(params, channel);

    // 5. Insert outbox log in PENDING status
    const { data: dbDelivery, error: insertError } = await adminSupabase
      .from('notification_deliveries')
      .insert({
        transaction_id: params.transaction_id,
        webhook_event_id: params.webhook_event_id || null,
        notification_type: `${params.direction.toLowerCase()}_alert`,
        channel,
        recipient: recipientPhone,
        message,
        deduplication_key: deduplicationKey,
        status: 'PENDING',
        attempt_count: 1
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Notification Alert] Failed logging delivery outbox:', insertError);
      return; // Stop if db insert fails to ensure outbox consistency
    }

    await logSystemAudit('NOTIFICATION_QUEUED', {
      delivery_id: dbDelivery.id,
      transaction_id: params.transaction_id,
      channel,
      recipient: recipientPhone
    });

    // 6. Send payload to provider
    let resultSuccess = false;
    let providerMessageId: string | null = null;
    let providerResponse: any = null;
    let errorMessage: string | null = null;

    if (channel === 'sms') {
      const apiKey = process.env.SCOPE_SMS_API_KEY || '';
      const senderId = settings?.sender_id || process.env.SCOPE_SMS_SENDER_ID || '';

      if (!apiKey) {
        errorMessage = 'SCOPE_SMS_API_KEY environment variable is missing';
      } else {
        const smsRes = await sendScopeSms(recipientPhone, message, { apiKey, senderId });
        resultSuccess = smsRes.success;
        providerMessageId = smsRes.messageId;
        providerResponse = smsRes.providerResponse;
        errorMessage = smsRes.errorMessage;
      }
    } else {
      const apiUrl = process.env.EVOLUTION_API_URL || '';
      const apiKey = process.env.EVOLUTION_API_KEY || '';
      const instance = process.env.EVOLUTION_INSTANCE || 'bingwazone';

      if (!apiUrl || !apiKey) {
        errorMessage = 'EVOLUTION_API_URL or EVOLUTION_API_KEY environment variable is missing';
      } else {
        const waRes = await sendEvolutionWhatsApp(recipientPhone, message, { apiUrl, apiKey, instance });
        resultSuccess = waRes.success;
        providerMessageId = waRes.messageId;
        providerResponse = waRes.providerResponse;
        errorMessage = waRes.errorMessage;
      }
    }

    const finalStatus = resultSuccess ? 'SENT' : 'FAILED';

    // 7. Update outbox record
    await adminSupabase
      .from('notification_deliveries')
      .update({
        status: finalStatus,
        provider_message_id: providerMessageId,
        provider_response: providerResponse,
        error_message: errorMessage,
        sent_at: resultSuccess ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', dbDelivery.id);

    // 8. Log system audit outcome
    if (resultSuccess) {
      await logSystemAudit('NOTIFICATION_SENT', {
        delivery_id: dbDelivery.id,
        transaction_id: params.transaction_id,
        channel,
        message_id: providerMessageId
      });
    } else {
      await logSystemAudit('NOTIFICATION_FAILED', {
        delivery_id: dbDelivery.id,
        transaction_id: params.transaction_id,
        channel,
        error: errorMessage
      });
    }
  } catch (err: any) {
    console.error('[Notification Flow Error] Critical crash in triggerNotificationFlow:', err);
  }
}
