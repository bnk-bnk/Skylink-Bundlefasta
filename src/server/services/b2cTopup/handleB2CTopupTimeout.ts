import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendTelegramAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
      });
    } catch (err) {
      console.error('Failed to send Telegram alert:', err);
    }
  }
}

export async function handleB2CTopupTimeout(payload: any, clientIp: string) {
  const conversationId = payload?.ConversationID || payload?.Result?.ConversationID;
  if (!conversationId) {
    throw new Error('Invalid payload: Missing ConversationID');
  }

  // 1. Load transaction
  const { data: trx, error: fetchError } = await supabase
    .from('b2c_account_topups')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!trx) {
    console.warn(`[Webhook B2C Topup Timeout] Transaction not found for ConversationID: ${conversationId}`);
    return { success: false, reason: 'Transaction not found' };
  }

  // Idempotency: Skip if already resolved (except queued/submitted/processing)
  if (trx.status === 'success' || trx.status === 'failed') {
    console.log(`[Webhook B2C Topup Timeout] Transaction ${trx.id} already resolved as: ${trx.status}`);
    return { success: true, reason: 'Already resolved' };
  }

  // 2. Perform DB Updates
  const { data: updatedTrx, error: updateError } = await supabase
    .from('b2c_account_topups')
    .update({
      status: 'timeout',
      timeout_received: true,
      result_code: 'timeout',
      result_description: 'Gateway request timed out (Safaricom QueueTimeout callback received).',
      updated_at: new Date().toISOString()
    })
    .eq('id', trx.id)
    .select()
    .single();

  if (updateError) throw updateError;

  // 3. Write Payout Audit Log
  await supabase.from('treasury_audit_logs').insert({
    topup_id: trx.id,
    action: 'gateway_timeout',
    metadata: { client_ip: clientIp, payload }
  });

  // 4. Trigger Notifications
  const alertMsg = `B2C float top up timed out for KES ${updatedTrx.amount.toLocaleString()} to shortcode ${updatedTrx.destination_shortcode}. The transaction is marked as timed out. Please reconcile manually.`;

  try {
    await supabase.from('notifications').insert({
      channel: 'dashboard',
      recipient: trx.created_by || 'admin',
      message: alertMsg,
      status: 'sent',
      created_at: new Date().toISOString()
    });
  } catch (notifErr) {
    console.error('[Webhook B2C Topup Timeout] Notification insertion failure:', notifErr);
  }

  // Send Telegram notification if configured
  await sendTelegramAlert(alertMsg);

  return { success: true, status: 'timeout' };
}
