import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createTransaction } from '@/lib/repositories/transactions';
import { logSystemAudit } from '@/lib/repositories/audit';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('B2B Result Callback Payload:', JSON.stringify(payload));

    const result = payload?.Result;
    if (!result) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid payload' }, { status: 400 });
    }

    const { ResultCode, ResultDesc, ConversationID, OriginatorConversationID, TransactionID } = result;
    const adminSupabase = createAdminClient();

    // 1. Idempotency Check: Fetch current B2B request state
    const { data: existingReq, error: fetchError } = await adminSupabase
      .from('b2b_requests')
      .select('*')
      .eq('conversation_id', ConversationID)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching B2B request:', fetchError);
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Database error' }, { status: 500 });
    }

    if (!existingReq) {
      console.warn(`B2B request not found for conversation_id: ${ConversationID}`);
      await logSystemAudit('B2B_CALLBACK_UNKNOWN_REQUEST', { conversationId: ConversationID, payload });
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Request not found but accepted' });
    }

    // If it's already processed, return early to prevent double-processing
    if (existingReq.status !== 'PENDING') {
      console.log(`B2B request ${existingReq.id} already processed with status: ${existingReq.status}. Skipping.`);
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Already processed' });
    }

    const status = ResultCode === 0 ? 'SUCCESS' : 'FAILED';

    // 2. Update the b2b_requests table
    const { data: updatedReq, error: updateError } = await adminSupabase
      .from('b2b_requests')
      .update({
        status,
        result_code: ResultCode,
        result_description: ResultDesc,
        response_payload: payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingReq.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating B2B request:', updateError);
      throw updateError;
    }

    // 3. Log in transaction ledger if successful
    if (ResultCode === 0) {
      // Create unified outgoing transaction record
      await createTransaction({
        direction: 'OUT',
        transaction_type: 'B2B',
        phone_number: existingReq.destination_shortcode, // B2B stores shortcode as destination
        amount: Number(existingReq.amount),
        mpesa_receipt: TransactionID || `B2B_${ConversationID.slice(-6)}`,
        status: 'SUCCESS',
        account_reference: existingReq.account_reference,
        description: existingReq.remarks || `B2B Settlement to ${existingReq.destination_shortcode}`,
        raw_payload: payload,
      });

      await logSystemAudit('B2B_CALLBACK_SUCCESS', {
        b2bRequestId: existingReq.id,
        conversationId: ConversationID,
        receipt: TransactionID,
        amount: existingReq.amount,
      });
    } else {
      await logSystemAudit('B2B_CALLBACK_FAILED', {
        b2bRequestId: existingReq.id,
        conversationId: ConversationID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      });
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error: any) {
    console.error('B2B Result Callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: error.message }, { status: 500 });
  }
}
