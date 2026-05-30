import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { logSystemAudit } from '@/lib/repositories/audit';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('B2B Timeout Callback Payload:', JSON.stringify(payload));

    // Safaricom timeout JSON structure is similar to Result or a simplified body
    const result = payload?.Result;
    const conversationId = result?.ConversationID || payload?.ConversationID;

    if (!conversationId) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Missing ConversationID' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 1. Fetch current B2B request state
    const { data: existingReq, error: fetchError } = await adminSupabase
      .from('b2b_requests')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching B2B request for timeout:', fetchError);
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Database error' }, { status: 500 });
    }

    if (!existingReq) {
      console.warn(`B2B request not found for timeout conversation_id: ${conversationId}`);
      await logSystemAudit('B2B_TIMEOUT_CALLBACK_UNKNOWN_REQUEST', { conversationId, payload });
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Request not found' });
    }

    // Only update if it's still pending
    if (existingReq.status === 'PENDING') {
      const { error: updateError } = await adminSupabase
        .from('b2b_requests')
        .update({
          status: 'TIMEOUT',
          result_description: 'Request timed out on Safaricom Daraja side.',
          response_payload: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingReq.id);

      if (updateError) {
        console.error('Error updating B2B request to TIMEOUT:', updateError);
        throw updateError;
      }

      await logSystemAudit('B2B_CALLBACK_TIMEOUT', {
        b2bRequestId: existingReq.id,
        conversationId,
      });
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Timeout acknowledged' });
  } catch (error: any) {
    console.error('B2B Timeout Callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: error.message }, { status: 500 });
  }
}
