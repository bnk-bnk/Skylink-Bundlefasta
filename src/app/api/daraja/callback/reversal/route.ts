import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createTransaction } from '@/lib/repositories/transactions';
import { logSystemAudit } from '@/lib/repositories/audit';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('Reversal Callback Payload:', JSON.stringify(payload));

    const result = payload?.Result;
    if (!result) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid payload' }, { status: 400 });
    }

    const { ResultCode, ResultDesc, ConversationID, TransactionID } = result;
    const adminSupabase = createAdminClient();

    const status = ResultCode === 0 ? 'SUCCESS' : 'FAILED';

    // 1. Update reversal_requests table
    const { data: revReq, error: fetchError } = await adminSupabase
      .from('reversal_requests')
      .update({
        status,
        response_payload: payload,
      })
      .eq('conversation_id', ConversationID)
      .select()
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching/updating reversal request:', fetchError);
    }

    // 2. Insert transaction on success
    if (ResultCode === 0 && revReq) {
      // Find the original transaction to see its direction
      const { data: originalTx } = await adminSupabase
        .from('transactions')
        .select('direction, amount, phone_number, source_id, account_reference')
        .eq('mpesa_receipt', revReq.receipt_number)
        .maybeSingle();

      // If original direction was IN, reversal direction is OUT (refunding).
      // If original direction was OUT, reversal direction is IN (returning).
      // Otherwise default to OUT.
      const direction = originalTx
        ? (originalTx.direction === 'IN' ? 'OUT' : 'IN')
        : 'OUT';

      const params = result.ResultParameters?.ResultParameter || [];
      const amountParam = params.find((p: any) => p.Key === 'Amount');
      
      const amount = amountParam 
        ? Number(amountParam.Value) 
        : (revReq.amount ? Number(revReq.amount) : (originalTx?.amount ? Number(originalTx.amount) : 0));
        
      const phoneNumber = originalTx?.phone_number || null;

      await createTransaction({
        direction,
        transaction_type: 'REVERSAL',
        account_reference: originalTx?.account_reference || null,
        phone_number: phoneNumber,
        amount,
        mpesa_receipt: TransactionID || `REV_${ConversationID.slice(-6)}`,
        status: 'SUCCESS',
        description: revReq.reason || 'Transaction Reversal processed successfully',
        raw_payload: payload,
      });

      // Update original transaction status to REVERSED if we want
      if (originalTx) {
        await adminSupabase
          .from('transactions')
          .update({
            status: 'FAILED',
            description: `Reversed by ${TransactionID}`,
            updated_at: new Date().toISOString(),
          })
          .eq('mpesa_receipt', revReq.receipt_number);
      }

      await logSystemAudit('REVERSAL_CALLBACK_SUCCESS', {
        conversationId: ConversationID,
        receipt: TransactionID,
        originalReceipt: revReq.receipt_number,
        amount,
      });
    } else {
      await logSystemAudit('REVERSAL_CALLBACK_FAILED', {
        conversationId: ConversationID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      });
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error: any) {
    console.error('Reversal Callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: error.message }, { status: 500 });
  }
}
