import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createTransaction } from '@/lib/repositories/transactions';
import { logSystemAudit } from '@/lib/repositories/audit';
import { triggerSmsNotification } from '@/lib/sms/send-sms';
import { triggerPesatrixWebhookForTransaction } from '@/lib/paybill-webhook';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('B2C Callback Payload:', JSON.stringify(payload));

    const result = payload?.Result;
    if (!result) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid payload' }, { status: 400 });
    }

    const { ResultCode, ResultDesc, ConversationID, OriginatorConversationID, TransactionID } = result;
    const adminSupabase = createAdminClient();

    const status = ResultCode === 0 ? 'SUCCESS' : 'FAILED';

    // 1. Update the b2c_requests table
    const { data: b2cReq, error: fetchError } = await adminSupabase
      .from('b2c_requests')
      .update({
        status,
        response_payload: payload,
      })
      .eq('conversation_id', ConversationID)
      .select()
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching/updating B2C request:', fetchError);
    }

    // 2. Log in transaction ledger if successful
    if (ResultCode === 0 && b2cReq) {
      const params = result.ResultParameters?.ResultParameter || [];
      const amountParam = params.find((p: any) => p.Key === 'TransactionAmount');
      const amount = amountParam ? Number(amountParam.Value) : Number(b2cReq.amount);

      const mpesaReceipt = TransactionID || `B2C_${ConversationID.slice(-6)}`;

      // Try to find if a Pesatrix withdrawal transaction exists with the same phone and amount
      const { data: existingTx } = await adminSupabase
        .from('transactions')
        .select('*')
        .eq('source_system', 'pesatrix')
        .eq('direction', 'OUT')
        .eq('amount', amount)
        .or(`recipient_phone.eq.${b2cReq.phone_number},phone_number.eq.${b2cReq.phone_number}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let transaction;
      if (existingTx) {
        // Match and update
        const { data: updatedTx, error: updateErr } = await adminSupabase
          .from('transactions')
          .update({
            status: 'SUCCESS',
            mpesa_receipt: mpesaReceipt,
            raw_payload: {
              ...existingTx.raw_payload,
              b2c_callback: payload
            },
            reconciliation_status: 'matched',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTx.id)
          .select()
          .single();
        
        if (updateErr) {
          console.error('Failed to update existing B2C transaction:', updateErr);
        }
        transaction = updatedTx;
      } else {
        // Create new transaction
        transaction = await createTransaction({
          direction: 'OUT',
          transaction_type: 'B2C',
          phone_number: b2cReq.phone_number,
          amount,
          mpesa_receipt: mpesaReceipt,
          status: 'SUCCESS',
          description: b2cReq.remarks || 'B2C Payout Completed successfully',
          raw_payload: payload,
        });
      }

      // Trigger SMS alerts in background (side-effect)
      triggerSmsNotification({
        direction: 'OUT',
        transaction_type: 'B2C',
        amount,
        account_reference: b2cReq.remarks || 'System Payout',
        phone_number: b2cReq.phone_number,
        mpesa_receipt: mpesaReceipt
      });

      // If transaction is from Pesatrix, notify the Pesatrix application
      if (transaction && transaction.source_system === 'pesatrix') {
        triggerPesatrixWebhookForTransaction(transaction.id).catch(err => {
          console.error('[B2C Callback] Failed triggering Pesatrix webhook:', err);
        });
      }

      await logSystemAudit('B2C_CALLBACK_SUCCESS', {
        conversationId: ConversationID,
        receipt: TransactionID,
        amount,
      });
    } else {
      await logSystemAudit('B2C_CALLBACK_FAILED', {
        conversationId: ConversationID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      });
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error: any) {
    console.error('B2C Callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: error.message }, { status: 500 });
  }
}
