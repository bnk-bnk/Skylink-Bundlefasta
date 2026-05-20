import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handleReversalTimeout(payload: any) {
  const result = payload?.Result;
  // Fallback to checking payload direct structure if queued out
  const conversationId = result?.ConversationID || payload?.ConversationID;

  if (!conversationId) {
    throw new Error('Invalid webhook timeout payload: Missing ConversationID');
  }

  // 1. Fetch query record from reversal_queries
  const { data: queryRecord, error: findError } = await supabase
    .from('reversal_queries')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (findError) {
    console.error('[ReversalTimeout] Query retrieval failed:', findError);
    throw new Error(`Failed to find reversal query record: ${findError.message}`);
  }

  if (!queryRecord) {
    console.warn(`[ReversalTimeout] No matching reversal query found for ConversationID: ${conversationId}`);
    return { status: 'not_found', conversationId };
  }

  // 2. Idempotency Check: Ignore if already processed
  if (['completed', 'failed', 'timeout'].includes(queryRecord.status)) {
    console.warn(`[ReversalTimeout] Duplicate callback ignored. Query ${queryRecord.id} is already in status: ${queryRecord.status}`);
    return { status: 'ignored', queryId: queryRecord.id };
  }

  // 3. Update query status to timeout
  const { error: updateError } = await supabase
    .from('reversal_queries')
    .update({
      status: 'timeout',
      raw_result: payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', queryRecord.id);

  if (updateError) {
    console.error('[ReversalTimeout] Failed to update query status:', updateError);
    throw updateError;
  }

  // 4. Log audit event
  await supabase.from('audit_logs').insert({
    user_id: queryRecord.created_by || null,
    action: 'REVERSAL_TIMEOUT',
    entity_type: 'reversal_queries',
    entity_id: queryRecord.id,
    new_values: { 
      original_receipt: queryRecord.original_receipt,
      amount: queryRecord.amount
    },
    ip_address: 'webhook_timeout'
  });

  // 5. Create real-time notification
  await supabase.from('notifications').insert({
    user_id: queryRecord.created_by || null,
    title: 'Reversal Callback Timeout',
    message: `Reversal request for receipt ${queryRecord.original_receipt} timed out in M-Pesa's callback queue.`,
    type: 'warning',
    read: false
  });

  return { status: 'timeout', queryId: queryRecord.id };
}
