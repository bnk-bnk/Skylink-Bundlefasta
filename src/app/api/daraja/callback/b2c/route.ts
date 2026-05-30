import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createTransaction } from '@/lib/repositories/transactions';
import { logSystemAudit } from '@/lib/repositories/audit';

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
      const amountParam = params.find((p: any) => p.Name === 'TransactionAmount');
      const amount = amountParam ? Number(amountParam.Value) : Number(b2cReq.amount);

      await createTransaction({
        direction: 'OUT',
        transaction_type: 'B2C',
        phone_number: b2cReq.phone_number,
        amount,
        mpesa_receipt: TransactionID || `B2C_${ConversationID.slice(-6)}`,
        status: 'SUCCESS',
        description: b2cReq.remarks || 'B2C Payout Completed successfully',
        raw_payload: payload,
      });

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
