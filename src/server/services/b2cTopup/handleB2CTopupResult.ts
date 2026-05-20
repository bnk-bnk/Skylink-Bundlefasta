import { createClient } from '@supabase/supabase-js';
import { parseB2CTopupResult } from './parseB2CTopupResult';

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

export async function handleB2CTopupResult(payload: any, clientIp: string) {
  const result = payload?.Result;
  if (!result) {
    throw new Error('Invalid payload: Missing Result object');
  }

  const conversationId = result.ConversationID;
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
    console.warn(`[Webhook B2C Topup] Transaction not found for ConversationID: ${conversationId}`);
    return { success: false, reason: 'Transaction not found' };
  }

  // Idempotency: Skip if already resolved
  if (trx.status === 'success' || trx.status === 'failed') {
    console.log(`[Webhook B2C Topup] Transaction ${trx.id} already resolved as: ${trx.status}`);
    return { success: true, reason: 'Already resolved' };
  }

  const parsed = parseB2CTopupResult(payload);
  const isSuccess = parsed.resultCode === '0';
  const finalStatus = isSuccess ? 'success' : 'failed';

  // 2. Perform DB Updates
  const { data: updatedTrx, error: updateError } = await supabase
    .from('b2c_account_topups')
    .update({
      status: finalStatus,
      transaction_id: parsed.transactionId || trx.transaction_id,
      result_code: parsed.resultCode,
      result_description: parsed.resultDesc,
      receiver_party_name: parsed.receiverPartyName || null,
      debit_account_balance: parsed.debitAccountBalance || null,
      debit_party_balance: parsed.debitPartyBalance || null,
      initiator_balance: parsed.initiatorBalance || null,
      transaction_completed_at: parsed.transactionCompletedAt 
        ? parsed.transactionCompletedAt.toISOString() 
        : new Date().toISOString(),
      raw_result: payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', trx.id)
    .select()
    .single();

  if (updateError) throw updateError;

  // 3. Write Payout Audit Log
  await supabase.from('treasury_audit_logs').insert({
    topup_id: trx.id,
    action: isSuccess ? 'callback_received_success' : 'callback_received_failure',
    metadata: { client_ip: clientIp, parsed_result: parsed }
  });

  // 4. Double-Entry Ledger Posting
  if (isSuccess && updatedTrx) {
    try {
      // Step A: Insert a record into main transactions table first to satisfy foreign key constraint in ledger_entries
      const { error: txInsertErr } = await supabase
        .from('transactions')
        .insert({
          id: updatedTrx.id,
          transaction_type: 'treasury_topup',
          direction: 'transfer',
          provider: 'mpesa',
          external_transaction_id: parsed.transactionId,
          reference: updatedTrx.account_reference || 'B2C_TOPUP',
          amount: updatedTrx.amount,
          status: 'completed',
          occurred_at: parsed.transactionCompletedAt 
            ? parsed.transactionCompletedAt.toISOString() 
            : new Date().toISOString()
        });

      if (txInsertErr) {
        console.error('[Webhook B2C Topup Transactions Insert Error] Failed to write mirroring transaction:', txInsertErr);
      }

      // Step B: Write ledger entries
      const { error: ledgerError } = await supabase.from('ledger_entries').insert([
        {
          transaction_id: updatedTrx.id,
          account_id: 'a3333333-3333-3333-3333-333333333333', // Disbursement Vault (DEBIT - asset increase)
          entry_type: 'DEBIT',
          amount: updatedTrx.amount
        },
        {
          transaction_id: updatedTrx.id,
          account_id: 'a1111111-1111-1111-1111-111111111111', // Paybill Collection Main (CREDIT - asset decrease)
          entry_type: 'CREDIT',
          amount: updatedTrx.amount
        }
      ]);

      if (ledgerError) {
        console.error('[Webhook B2C Topup Ledger Error] Failed to write ledger entries:', ledgerError);
      } else {
        // Step C: Update account balances in database
        // Paybill Collection Main (subtract amount)
        await supabase.rpc('decrement_account_balance', { 
          account_uuid: 'a1111111-1111-1111-1111-111111111111', 
          amount_val: updatedTrx.amount 
        });

        // Disbursements Vault (add amount)
        await supabase.rpc('increment_account_balance', { 
          account_uuid: 'a3333333-3333-3333-3333-333333333333', 
          amount_val: updatedTrx.amount 
        });
      }
    } catch (ledgerExc) {
      console.error('[Webhook B2C Topup Ledger Exception]', ledgerExc);
    }
  }

  // 5. Trigger Platform & Channel Notifications
  const alertMsg = isSuccess 
    ? `B2C account topped up successfully. KES ${updatedTrx.amount.toLocaleString()} transferred from primary working account to utility shortcode ${updatedTrx.destination_shortcode}.`
    : `B2C float top up failed for KES ${updatedTrx.amount.toLocaleString()} to shortcode ${updatedTrx.destination_shortcode}: ${parsed.resultDesc}`;

  try {
    await supabase.from('notifications').insert({
      channel: 'dashboard',
      recipient: trx.created_by || 'admin',
      message: alertMsg,
      status: 'sent',
      created_at: new Date().toISOString()
    });
  } catch (notifErr) {
    console.error('[Webhook B2C Topup] Notification insertion failure:', notifErr);
  }

  // Send Telegram notification if configured
  await sendTelegramAlert(alertMsg);

  return { success: true, status: finalStatus };
}
