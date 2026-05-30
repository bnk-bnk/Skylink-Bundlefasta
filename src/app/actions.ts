'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getDashboardStats, getTransactions, createTransaction, TransactionFilters } from '@/lib/repositories/transactions';
import { getAnalyticsData } from '@/lib/repositories/analytics';
import { verifyDashboardPin, setDashboardPin, hasPinConfigured } from '@/lib/repositories/pin';
import { logAudit } from '@/lib/repositories/audit';
import { DarajaService } from '@/lib/services/daraja';
import { revalidatePath } from 'next/cache';
import {
  createB2bRequest,
  getB2bStats,
  getB2bRequests,
  getSettlementRules,
  createSettlementRule,
  deleteSettlementRule,
  getSettlementQueue,
} from '@/lib/repositories/b2b';

// Helper to check user auth
async function checkAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Unauthorized access');
  }
  return user;
}

// 1. Dashboard statistics
export async function getDashboardStatsAction() {
  await checkAuth();
  return await getDashboardStats();
}

// 2. Transactions fetcher
export async function getTransactionsAction(filters: TransactionFilters = {}) {
  await checkAuth();
  return await getTransactions(filters);
}

// 3. Analytics fetcher
export async function getAnalyticsAction() {
  await checkAuth();
  return await getAnalyticsData();
}

// 4. PIN operations
export async function verifyPinAction(pin: string) {
  const user = await checkAuth();
  const isValid = await verifyDashboardPin(user.id, pin);
  if (isValid) {
    await logAudit('PIN_VERIFIED', { userId: user.id });
  } else {
    await logAudit('PIN_VERIFICATION_FAILED', { userId: user.id });
  }
  return isValid;
}

export async function setPinAction(pin: string) {
  const user = await checkAuth();
  const success = await setDashboardPin(user.id, pin);
  if (success) {
    await logAudit('PIN_CHANGED', { userId: user.id });
  }
  return success;
}

export async function hasPinAction() {
  const user = await checkAuth();
  return await hasPinConfigured(user.id);
}

export async function refreshBalanceAction() {
  const user = await checkAuth();
  
  try {
    const res = await DarajaService.queryAccountBalance();

    if (res.ResponseCode && res.ResponseCode !== '0') {
      throw new Error(res.ResponseDescription || 'M-Pesa balance query rejected.');
    }

    if (res.isMock) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }

    const supabase = await createClient();
    const { data: snapshot } = await supabase
      .from('balance_snapshots')
      .select('balance, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshot) {
      await logAudit('BALANCE_REFRESHED', { balance: snapshot.balance, fetchedAt: snapshot.fetched_at });
      return { success: true, balance: snapshot.balance, fetchedAt: snapshot.fetched_at };
    }
    
    return { success: true, pending: true, message: 'Request sent. Callback processing...' };
  } catch (error: any) {
    console.error('Balance query action failed:', error);
    return { success: false, error: error.message };
  }
}

// 6. STK Push Actions
export async function initiateStkPushAction(params: {
  phone: string;
  amount: number;
  reference: string;
  description: string;
  pin: string;
}) {
  const user = await checkAuth();

  // 1. Confirm PIN first
  const isPinValid = await verifyDashboardPin(user.id, params.pin);
  if (!isPinValid) {
    await logAudit('STK_PUSH_BLOCKED_BAD_PIN', { phone: params.phone, amount: params.amount });
    return { success: false, error: 'Incorrect Dashboard PIN' };
  }

  const adminSupabase = createAdminClient();

  try {
    // 2. Call Daraja
    const res = await DarajaService.initiateStkPush({
      phoneNumber: params.phone,
      amount: params.amount,
      accountReference: params.reference,
      description: params.description,
    });

    // 3. Insert stk_requests
    const { data, error } = await adminSupabase
      .from('stk_requests')
      .insert({
        phone_number: params.phone,
        amount: params.amount,
        account_reference: params.reference,
        merchant_request_id: res.MerchantRequestID || null,
        checkout_request_id: res.CheckoutRequestID || null,
        status: 'PENDING',
        response_payload: res,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit('STK_PUSH_INITIATED', {
      phone: params.phone,
      amount: params.amount,
      reference: params.reference,
      checkoutRequestId: res.CheckoutRequestID,
    });

    return { success: true, data };
  } catch (error: any) {
    console.error('STK push action failed:', error);
    return { success: false, error: error.message };
  }
}

export async function queryStkStatusAction(checkoutRequestId: string) {
  await checkAuth();
  try {
    const res = await DarajaService.queryStkStatus(checkoutRequestId);
    return { success: true, status: res.ResultDesc || res.ResponseDescription || 'Pending callback' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 7. B2C Payout Actions
export async function sendB2cAction(params: {
  phone: string;
  amount: number;
  remarks: string;
  pin: string;
}) {
  const user = await checkAuth();
  
  // 1. Confirm PIN first
  const isPinValid = await verifyDashboardPin(user.id, params.pin);
  if (!isPinValid) {
    await logAudit('B2C_PAYOUT_BLOCKED_BAD_PIN', { phone: params.phone, amount: params.amount });
    return { success: false, error: 'Incorrect Dashboard PIN' };
  }

  const adminSupabase = createAdminClient();

  try {
    // 2. Call Daraja
    const res = await DarajaService.initiateB2c({
      phoneNumber: params.phone,
      amount: params.amount,
      remarks: params.remarks,
    });

    // 3. Insert B2C request
    const { data, error } = await adminSupabase
      .from('b2c_requests')
      .insert({
        phone_number: params.phone,
        amount: params.amount,
        remarks: params.remarks,
        conversation_id: res.ConversationID || null,
        originator_conversation_id: res.OriginatorConversationID || null,
        status: 'PENDING',
        response_payload: res,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit('B2C_PAYOUT_INITIATED', {
      phone: params.phone,
      amount: params.amount,
      conversationId: res.ConversationID,
    });

    return { success: true, data };
  } catch (error: any) {
    console.error('B2C payout action failed:', error);
    return { success: false, error: error.message };
  }
}

// 8. Reversal Actions
export async function requestReversalAction(params: {
  receipt: string;
  amount: number;
  reason: string;
  pin: string;
}) {
  const user = await checkAuth();

  // 1. Confirm PIN
  const isPinValid = await verifyDashboardPin(user.id, params.pin);
  if (!isPinValid) {
    await logAudit('REVERSAL_BLOCKED_BAD_PIN', { receipt: params.receipt, amount: params.amount });
    return { success: false, error: 'Incorrect Dashboard PIN' };
  }

  const adminSupabase = createAdminClient();

  try {
    // 2. Call Daraja
    const res = await DarajaService.requestReversal({
      receiptNumber: params.receipt,
      amount: params.amount,
      reason: params.reason,
    });

    // 3. Insert Reversal Request
    const { data, error } = await adminSupabase
      .from('reversal_requests')
      .insert({
        receipt_number: params.receipt,
        amount: params.amount,
        reason: params.reason,
        conversation_id: res.ConversationID || null,
        status: 'PENDING',
        response_payload: res,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit('REVERSAL_INITIATED', {
      receipt: params.receipt,
      amount: params.amount,
      conversationId: res.ConversationID,
    });

    return { success: true, data };
  } catch (error: any) {
    console.error('Reversal request action failed:', error);
    return { success: false, error: error.message };
  }
}

// 9. Fetch Audit Logs
export async function getAuditLogsAction(limitVal: number = 50) {
  await checkAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limitVal);

  if (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }

  return data || [];
}

// 10. Fetch Product Sources
export async function getProductSourcesAction() {
  await checkAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('product_sources')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Failed to get product sources:', error);
    return [];
  }

  return data || [];
}

// 11. Add a new Product Source
export async function addProductSourceAction(name: string, reference: string) {
  await checkAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('product_sources')
    .insert({
      name,
      reference: reference.toUpperCase().trim(),
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to add product source:', error);
    return { success: false, error: error.message };
  }

  await logAudit('PRODUCT_SOURCE_ADDED', { name, reference });
  return { success: true, data };
}

// 12. Developer Simulation Actions (Mock C2B Trigger)
export async function simulateC2bAction(params: {
  phone: string;
  amount: number;
  reference: string;
}) {
  await checkAuth();
  
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${appUrl}/api/mock/c2b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error || 'Simulation request failed' };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 13. Fetch all transactions for Analytics within a range (no pagination limits)
export async function getAnalyticsTransactionsAction(filters: { dateStart?: string; dateEnd?: string }) {
  await checkAuth();
  const supabase = await createClient();
  let query = supabase
    .from('transactions')
    .select(`
      *,
      product_sources (
        id,
        name,
        reference
      )
    `)
    .order('created_at', { ascending: true });

  if (filters.dateStart) {
    query = query.gte('created_at', filters.dateStart);
  }
  if (filters.dateEnd) {
    query = query.lte('created_at', filters.dateEnd);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to fetch analytics transactions:', error);
    return [];
  }
  return data || [];
}

// 14. Bulk Delete Transactions
export async function deleteTransactionsAction(ids: string[]) {
  await checkAuth();
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from('transactions')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Failed to bulk delete transactions:', error);
    return { success: false, error: error.message };
  }

  await logAudit('BULK_TRANSACTIONS_DELETED', { count: ids.length, ids });
  return { success: true };
}

// 15. Update Password
export async function updatePasswordAction(password: string) {
  await checkAuth();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error('Failed to change password:', error);
    return { success: false, error: error.message };
  }

  await logAudit('PASSWORD_CHANGED');
  return { success: true };
}

// 16. B2B Settlement Actions
export async function initiateB2bAction(params: {
  destinationType: 'Till' | 'PayBill';
  destinationShortcode: string;
  amount: number;
  accountReference: string;
  remarks: string;
  pin: string;
}) {
  const user = await checkAuth();

  // 1. Confirm PIN first
  const isPinValid = await verifyDashboardPin(user.id, params.pin);
  if (!isPinValid) {
    await logAudit('B2B_SETTLEMENT_BLOCKED_BAD_PIN', { destination: params.destinationShortcode, amount: params.amount });
    return { success: false, error: 'Incorrect Dashboard PIN' };
  }

  const adminSupabase = createAdminClient();

  try {
    // 2. Fetch latest balance snapshot to check funds availability
    const { data: balanceData } = await adminSupabase
      .from('balance_snapshots')
      .select('balance')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBalance = balanceData?.balance || 0;
    if (currentBalance < params.amount) {
      await logAudit('B2B_SETTLEMENT_BLOCKED_INSUFFICIENT_BALANCE', {
        amount: params.amount,
        balance: currentBalance,
      });
      return {
        success: false,
        error: `Insufficient funds. Current balance is KES ${currentBalance.toLocaleString()}. Requested settlement is KES ${params.amount.toLocaleString()}.`,
      };
    }

    // 3. Create database record FIRST (PENDING state)
    const commandId = params.destinationType === 'Till' ? 'BusinessBuyGoods' : 'BusinessPayBill';
    const dbRecord = await createB2bRequest({
      amount: params.amount,
      destination_shortcode: params.destinationShortcode,
      destination_type: params.destinationType,
      command_id: commandId,
      account_reference: params.accountReference,
      remarks: params.remarks,
      status: 'PENDING',
    });

    // 4. Call Daraja
    let res;
    try {
      res = await DarajaService.initiateB2b({
        destinationType: params.destinationType,
        destinationShortcode: params.destinationShortcode,
        amount: params.amount,
        accountReference: params.accountReference,
        remarks: params.remarks,
      });
    } catch (apiError: any) {
      // If Daraja fails, update B2B request status to FAILED
      await adminSupabase
        .from('b2b_requests')
        .update({
          status: 'FAILED',
          result_description: apiError.message || 'API Call failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbRecord.id);

      await logAudit('B2B_SETTLEMENT_API_FAILED', {
        id: dbRecord.id,
        error: apiError.message,
      });

      throw apiError;
    }

    // 5. Update B2B request with conversation ids from Daraja API response
    const { data: updatedRecord, error: updateErr } = await adminSupabase
      .from('b2b_requests')
      .update({
        conversation_id: res.ConversationID || null,
        originator_conversation_id: res.OriginatorConversationID || null,
        response_payload: res,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbRecord.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await logAudit('B2B_SETTLEMENT_INITIATED', {
      id: dbRecord.id,
      destination: params.destinationShortcode,
      amount: params.amount,
      conversationId: res.ConversationID,
    });

    return { success: true, data: updatedRecord };
  } catch (error: any) {
    console.error('B2B Settlement action failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getB2bStatsAction() {
  await checkAuth();
  return await getB2bStats();
}

export async function getB2bRequestsAction(filters: { status?: string; destinationType?: string; limit?: number; offset?: number } = {}) {
  await checkAuth();
  return await getB2bRequests(filters);
}

export async function getSettlementRulesAction() {
  await checkAuth();
  return await getSettlementRules();
}

export async function createSettlementRuleAction(rule: {
  source_reference: string;
  rule_type: string;
  percentage?: number | null;
  fixed_amount?: number | null;
  destination_shortcode: string;
  destination_type: string;
}) {
  await checkAuth();
  const res = await createSettlementRule(rule);
  await logAudit('SETTLEMENT_RULE_CREATED', {
    ruleId: res.id,
    source: rule.source_reference,
    type: rule.rule_type,
  });
  return res;
}

export async function deleteSettlementRuleAction(id: string) {
  await checkAuth();
  await deleteSettlementRule(id);
  await logAudit('SETTLEMENT_RULE_DELETED', { ruleId: id });
  return true;
}

export async function getSettlementQueueAction() {
  await checkAuth();
  return await getSettlementQueue();
}
