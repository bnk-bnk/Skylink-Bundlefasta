import { createClient, createAdminClient } from '../supabase/server';
import { B2bRequest, SettlementRule, SettlementQueue } from '@/types/database';
import { DarajaService } from '../services/daraja';
import { logSystemAudit } from './audit';

// 1. Create B2B Request
export async function createB2bRequest(params: {
  amount: number;
  destination_shortcode: string;
  destination_type: string;
  command_id: string;
  account_reference: string;
  remarks?: string;
  status?: string;
  conversation_id?: string;
  originator_conversation_id?: string;
}) {
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from('b2b_requests')
    .insert({
      amount: params.amount,
      destination_shortcode: params.destination_shortcode,
      destination_type: params.destination_type,
      command_id: params.command_id,
      account_reference: params.account_reference,
      remarks: params.remarks || null,
      status: params.status || 'PENDING',
      conversation_id: params.conversation_id || null,
      originator_conversation_id: params.originator_conversation_id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create B2B request:', error);
    throw error;
  }

  return data;
}

// 2. Update B2B Request (Callbacks / Status check)
export async function updateB2bRequest(
  conversationId: string,
  updates: {
    status?: string;
    result_code?: number | null;
    result_description?: string | null;
    response_payload?: any;
    originator_conversation_id?: string;
  }
) {
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from('b2b_requests')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('conversation_id', conversationId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to update B2B request:', error);
    throw error;
  }

  return data;
}

// 3. Get B2B Stats for Dashboard and Analytics
export async function getB2bStats() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();

  // Today's total settlements (SUCCESS status)
  const { data: todaySuccess } = await supabase
    .from('b2b_requests')
    .select('amount')
    .eq('status', 'SUCCESS')
    .gte('created_at', todayISO);

  const totalSettledToday = (todaySuccess || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0);

  // Month total settlements
  const { data: monthSuccess } = await supabase
    .from('b2b_requests')
    .select('amount')
    .eq('status', 'SUCCESS')
    .gte('created_at', monthISO);

  const totalSettledMonth = (monthSuccess || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0);

  // Pending settlements count & sum
  const { data: pendingReqs } = await supabase
    .from('b2b_requests')
    .select('amount')
    .eq('status', 'PENDING');

  const pendingCount = pendingReqs?.length || 0;
  const pendingAmount = (pendingReqs || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0);

  // Successful settlements count & sum
  const { data: successReqs } = await supabase
    .from('b2b_requests')
    .select('amount')
    .eq('status', 'SUCCESS');

  const successCount = successReqs?.length || 0;
  const successAmount = (successReqs || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0);

  // Failed settlements count & sum
  const { data: failedReqs } = await supabase
    .from('b2b_requests')
    .select('amount')
    .eq('status', 'FAILED');

  const failedCount = failedReqs?.length || 0;
  const failedAmount = (failedReqs || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0);

  // Success and failure rates
  const totalCompleted = successCount + failedCount;
  const successRate = totalCompleted > 0 ? (successCount / totalCompleted) * 100 : 0;
  const failureRate = totalCompleted > 0 ? (failedCount / totalCompleted) * 100 : 0;

  return {
    totalSettledToday,
    totalSettledMonth,
    pendingCount,
    pendingAmount,
    successCount,
    successAmount,
    failedCount,
    failedAmount,
    successRate,
    failureRate,
  };
}

// 4. Fetch list of B2B Requests
export async function getB2bRequests(filters: { status?: string; destinationType?: string; limit?: number; offset?: number } = {}) {
  const supabase = await createClient();

  let query = supabase
    .from('b2b_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.destinationType) {
    query = query.eq('destination_type', filters.destinationType);
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    console.error('Failed to fetch B2B requests:', error);
    return [];
  }

  return data || [];
}

// 5. Settlement Rules Management
export async function getSettlementRules() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('settlement_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get settlement rules:', error);
    return [];
  }

  return data || [];
}

export async function createSettlementRule(rule: {
  source_reference: string;
  rule_type: string;
  percentage?: number | null;
  fixed_amount?: number | null;
  destination_shortcode: string;
  destination_type: string;
  active?: boolean;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('settlement_rules')
    .insert({
      source_reference: rule.source_reference.trim().toUpperCase(),
      rule_type: rule.rule_type,
      percentage: rule.percentage || null,
      fixed_amount: rule.fixed_amount || null,
      destination_shortcode: rule.destination_shortcode,
      destination_type: rule.destination_type,
      active: rule.active !== undefined ? rule.active : true,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create settlement rule:', error);
    throw error;
  }

  return data;
}

export async function deleteSettlementRule(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('settlement_rules')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete settlement rule:', error);
    throw error;
  }

  return true;
}

// 6. Settlement Rule Engine: calculate and populate settlement_queue
export async function triggerSettlementRule(
  transactionId: string,
  accountReference: string | null,
  amount: number
) {
  if (!accountReference) return null;

  const adminSupabase = createAdminClient();
  const cleanRef = accountReference.trim().toUpperCase();

  // Run automated B2B split settlement in background if reference matches PESATRIX or PESAFRIX
  if (cleanRef === 'PESATRIX' || cleanRef === 'PESAFRIX') {
    performAutoB2bSettlement(transactionId, cleanRef, amount);
  }

  // Find active settlement rules for this product source reference
  const { data: rules, error } = await adminSupabase
    .from('settlement_rules')
    .select('*')
    .eq('source_reference', cleanRef)
    .eq('active', true);

  if (error) {
    console.error('Failed to query rules for reference:', cleanRef, error);
    return null;
  }

  if (!rules || rules.length === 0) {
    return null;
  }

  const queueEntries = [];

  for (const rule of rules) {
    let settlementAmount = 0;

    if (rule.rule_type === 'PERCENTAGE' && rule.percentage) {
      settlementAmount = (amount * Number(rule.percentage)) / 100;
    } else if (rule.rule_type === 'FIXED' && rule.fixed_amount) {
      settlementAmount = Number(rule.fixed_amount);
    }

    if (settlementAmount <= 0) continue;

    // Create entry in settlement_queue
    const { data: queueItem, error: queueError } = await adminSupabase
      .from('settlement_queue')
      .insert({
        transaction_id: transactionId,
        settlement_rule_id: rule.id,
        amount: settlementAmount,
        status: 'PENDING',
        attempts: 0,
      })
      .select()
      .single();

    if (queueError) {
      console.error('Failed to insert settlement queue item:', queueError);
    } else {
      queueEntries.push(queueItem);
    }
  }

  return queueEntries;
}

/**
 * Automatically dispatches a background B2B transaction sending KES 300 for every 500 received (60% split)
 * from Pesatrix/Pesafrix to the Till Number configured by the admin in Settings.
 */
export async function performAutoB2bSettlement(
  transactionId: string,
  reference: string,
  incomingAmount: number
) {
  try {
    const adminSupabase = createAdminClient();

    // 1. Fetch Till Number from settings
    const { data: settings } = await adminSupabase
      .from('sms_settings')
      .select('pesafrix_till_number')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    const tillNumber = settings?.pesafrix_till_number || '';
    if (!tillNumber) {
      console.warn('[Auto B2B Engine] Pesafrix Till Number is not configured in settings. Skipping automated settlement.');
      return;
    }

    // 2. Proportional split (300 for every 500 = 60%)
    const settlementAmount = Math.round((incomingAmount * 0.6) * 100) / 100;
    if (settlementAmount <= 0) {
      console.log('[Auto B2B Engine] Calculated settlement amount is <= 0. Skipping.');
      return;
    }

    // 3. Create B2B request log in PENDING state
    const { data: b2bRequest, error: b2bError } = await adminSupabase
      .from('b2b_requests')
      .insert({
        amount: settlementAmount,
        destination_shortcode: tillNumber,
        destination_type: 'Till',
        command_id: 'BusinessBuyGoods',
        account_reference: reference,
        remarks: `Auto B2B split (60%) of KES ${incomingAmount} from reference ${reference}`,
        status: 'PENDING',
      })
      .select()
      .single();

    if (b2bError) {
      console.error('[Auto B2B Engine] Failed to record auto B2B request:', b2bError);
      return;
    }

    // 4. Create PENDING queue log entry
    const { data: queueItem, error: queueError } = await adminSupabase
      .from('settlement_queue')
      .insert({
        transaction_id: transactionId,
        amount: settlementAmount,
        status: 'PENDING',
        attempts: 1,
      })
      .select()
      .single();

    if (queueError) {
      console.error('[Auto B2B Engine] Failed to log auto queue item:', queueError);
    }

    // 5. Fire off B2B settlement to Daraja
    try {
      const res = await DarajaService.initiateB2b({
        destinationType: 'Till',
        destinationShortcode: tillNumber,
        amount: settlementAmount,
        accountReference: reference,
        remarks: 'Auto split 60%',
      });

      // Update B2B request record
      await adminSupabase
        .from('b2b_requests')
        .update({
          conversation_id: res.ConversationID || null,
          originator_conversation_id: res.OriginatorConversationID || null,
          response_payload: res,
          updated_at: new Date().toISOString(),
        })
        .eq('id', b2bRequest.id);

      // Update Queue status
      if (queueItem) {
        await adminSupabase
          .from('settlement_queue')
          .update({
            status: 'PROCESSED',
            processed_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id);
      }

      await logSystemAudit('B2B_SETTLEMENT_INITIATED', {
        id: b2bRequest.id,
        destination: tillNumber,
        amount: settlementAmount,
        conversationId: res.ConversationID,
        type: 'AUTOMATED',
      });
    } catch (apiError: any) {
      // Mark failed
      await adminSupabase
        .from('b2b_requests')
        .update({
          status: 'FAILED',
          result_description: apiError.message || 'API Call failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', b2bRequest.id);

      if (queueItem) {
        await adminSupabase
          .from('settlement_queue')
          .update({
            status: 'FAILED',
          })
          .eq('id', queueItem.id);
      }

      await logSystemAudit('B2B_SETTLEMENT_API_FAILED', {
        id: b2bRequest.id,
        error: apiError.message,
        type: 'AUTOMATED',
      });
    }
  } catch (err) {
    console.error('[Auto B2B Engine Fatal Error] Error running auto B2B split logic:', err);
  }
}

export async function getSettlementQueue() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('settlement_queue')
    .select(`
      *,
      settlement_rules (
        source_reference,
        rule_type,
        destination_shortcode,
        destination_type
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get settlement queue:', error);
    return [];
  }

  return data || [];
}
