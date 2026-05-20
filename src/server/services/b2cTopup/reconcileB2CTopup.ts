import { createClient } from '@supabase/supabase-js';
import { DarajaService } from '../daraja/darajaService';
import { resolveConfig } from '../daraja/darajaClient';
import { encryptInitiatorPassword } from './initiateB2CTopup';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function reconcileB2CTopup(topupId: string, options: { action: 'query' | 'force', externalTransactionId?: string, actor?: string }) {
  const { action, externalTransactionId, actor = 'admin' } = options;

  // 1. Fetch transaction
  const { data: trx, error: fetchError } = await supabase
    .from('b2c_account_topups')
    .select('*')
    .eq('id', topupId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!trx) throw new Error('Transaction not found');

  if (trx.status === 'success') {
    return { success: true, message: 'Transaction already successfully resolved', status: trx.status };
  }

  if (action === 'force') {
    if (!externalTransactionId) {
      throw new Error('Receipt number (External Transaction ID) is required for force reconciliation.');
    }

    // Resolve as success
    const { data: updatedTrx, error: updateError } = await supabase
      .from('b2c_account_topups')
      .update({
        status: 'success',
        transaction_id: externalTransactionId,
        result_code: '0',
        result_description: 'Force reconciled by administrator.',
        transaction_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', trx.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log to treasury audit logs
    await supabase.from('treasury_audit_logs').insert({
      topup_id: trx.id,
      action: 'manual_force_reconcile',
      metadata: { actor, externalTransactionId }
    });

    // Write Ledger entries
    try {
      // Step A: Insert a record into main transactions table first to satisfy foreign key constraint
      await supabase
        .from('transactions')
        .insert({
          id: updatedTrx.id,
          transaction_type: 'treasury_topup',
          direction: 'transfer',
          provider: 'mpesa',
          external_transaction_id: externalTransactionId,
          reference: updatedTrx.account_reference || 'B2C_TOPUP',
          amount: updatedTrx.amount,
          status: 'completed',
          occurred_at: new Date().toISOString()
        });

      // Step B: Write ledger entries
      await supabase.from('ledger_entries').insert([
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

      // Step C: Update account balances in database
      await supabase.rpc('decrement_account_balance', { 
        account_uuid: 'a1111111-1111-1111-1111-111111111111', 
        amount_val: updatedTrx.amount 
      });
      await supabase.rpc('increment_account_balance', { 
        account_uuid: 'a3333333-3333-3333-3333-333333333333', 
        amount_val: updatedTrx.amount 
      });
    } catch (ledgerErr) {
      console.error('[Force Reconcile Ledger Error]', ledgerErr);
    }

    return { success: true, message: 'Transaction force-reconciled successfully', status: 'success' };
  } else {
    // action === 'query'
    if (!externalTransactionId && !trx.transaction_id) {
      throw new Error('External Transaction ID is required to query Safaricom status.');
    }

    const receiptId = externalTransactionId || trx.transaction_id;
    const config = await resolveConfig();
    const initiatorName = process.env.MPESA_INITIATOR_NAME || config.initiatorName || 'api_user';
    const initiatorPassword = process.env.MPESA_INITIATOR_PASSWORD || '';
    const securityCredential = initiatorPassword 
      ? await encryptInitiatorPassword(initiatorPassword, config.env)
      : config.securityCredential || 'credential';

    const result = await DarajaService.queryTransactionStatus({
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      TransactionID: receiptId!,
      PartyA: trx.source_shortcode,
      IdentifierType: '4',
      ResultURL: process.env.MPESA_B2C_RECONCILE_RESULT_URL || config.callbackUrl,
      QueueTimeOutURL: process.env.MPESA_B2C_RECONCILE_TIMEOUT_URL || config.callbackUrl,
      Remarks: 'Manual status check'
    });

    await supabase.from('treasury_audit_logs').insert({
      topup_id: trx.id,
      action: 'query_status_dispatched',
      metadata: { actor, externalTransactionId: receiptId, daraja_response: result }
    });

    return { success: true, message: 'Transaction status query submitted to Daraja', status: trx.status, response: result };
  }
}
