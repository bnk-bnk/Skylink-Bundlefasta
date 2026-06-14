import { createClient, createAdminClient } from '../supabase/server';
import { Transaction, TransactionDirection, TransactionType, TransactionStatus } from '@/types/database';

// Resolve the product source ID by its account reference string
export async function resolveSourceId(referenceText: string | null): Promise<string | null> {
  if (!referenceText) return null;
  
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    supabase = createAdminClient();
  }
  const cleanRef = referenceText.trim().toUpperCase();

  // Search product_sources (case-insensitive checking is safer)
  const { data, error } = await supabase
    .from('product_sources')
    .select('id')
    .eq('reference', cleanRef)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) {
    // If not found in exact reference, try searching with ILIKE or return null
    const { data: ilikeData } = await supabase
      .from('product_sources')
      .select('id')
      .ilike('reference', cleanRef)
      .eq('active', true)
      .maybeSingle();

    return ilikeData?.id || null;
  }

  return data.id;
}

export interface TransactionFilters {
  direction?: TransactionDirection;
  transactionType?: TransactionType;
  sourceId?: string;
  phoneNumber?: string;
  accountReference?: string;
  status?: TransactionStatus;
  dateStart?: string;
  dateEnd?: string;
  limit?: number;
  offset?: number;
  sourceSystem?: string;
  paymentType?: string;
  module?: string;
  productStream?: string;
  serviceSource?: string;
  currency?: string;
  minAmount?: number;
  maxAmount?: number;
  reconciliationStatus?: string;
  receiptSearch?: string;
  phoneSearch?: string;
  agentNameOrUsername?: string;
  userIdOrAgentId?: string;
}

// Fetch all transactions with filters
export async function getTransactions(filters: TransactionFilters = {}) {
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
    `, { count: 'exact' }) // Ensure we get the exact count
    .order('created_at', { ascending: false });

  if (filters.direction) {
    query = query.eq('direction', filters.direction);
  }
  if (filters.transactionType) {
    query = query.eq('transaction_type', filters.transactionType);
  }
  if (filters.sourceId) {
    if (filters.sourceId === 'null') {
      query = query.is('source_id', null);
    } else {
      query = query.eq('source_id', filters.sourceId);
    }
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.phoneNumber) {
    query = query.or(`phone_number.ilike.%${filters.phoneNumber}%,payer_phone.ilike.%${filters.phoneNumber}%,recipient_phone.ilike.%${filters.phoneNumber}%`);
  }
  if (filters.accountReference) {
    query = query.ilike('account_reference', `%${filters.accountReference}%`);
  }
  if (filters.dateStart) {
    query = query.gte('created_at', filters.dateStart);
  }
  if (filters.dateEnd) {
    query = query.lte('created_at', filters.dateEnd);
  }
  
  // New column filters
  if (filters.sourceSystem) {
    query = query.eq('source_system', filters.sourceSystem);
  }
  if (filters.paymentType) {
    query = query.eq('payment_type', filters.paymentType);
  }
  if (filters.module) {
    query = query.eq('module', filters.module);
  }
  if (filters.productStream) {
    query = query.eq('product_stream', filters.productStream);
  }
  if (filters.serviceSource) {
    query = query.eq('service_source', filters.serviceSource);
  }
  if (filters.currency) {
    query = query.eq('currency', filters.currency);
  }
  if (filters.minAmount !== undefined) {
    query = query.gte('amount', filters.minAmount);
  }
  if (filters.maxAmount !== undefined) {
    query = query.lte('amount', filters.maxAmount);
  }
  if (filters.reconciliationStatus) {
    query = query.eq('reconciliation_status', filters.reconciliationStatus);
  }
  if (filters.receiptSearch) {
    query = query.or(`mpesa_receipt.ilike.%${filters.receiptSearch}%,receipt.ilike.%${filters.receiptSearch}%`);
  }
  if (filters.phoneSearch) {
    query = query.or(`phone_number.ilike.%${filters.phoneSearch}%,payer_phone.ilike.%${filters.phoneSearch}%,recipient_phone.ilike.%${filters.phoneSearch}%,counterparty_phone.ilike.%${filters.phoneSearch}%`);
  }
  if (filters.agentNameOrUsername) {
    query = query.or(`agent_name.ilike.%${filters.agentNameOrUsername}%,agent_username.ilike.%${filters.agentNameOrUsername}%,agent_business_name.ilike.%${filters.agentNameOrUsername}%`);
  }
  if (filters.userIdOrAgentId) {
    query = query.or(`external_user_id.ilike.%${filters.userIdOrAgentId}%,external_agent_id.ilike.%${filters.userIdOrAgentId}%`);
  }
  
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to get transactions:', error);
    return { data: [], count: 0 };
  }

  return { data: data || [], count: count || 0 };
}

// Write new transaction and auto-resolve source ID
export async function createTransaction(tx: {
  direction: TransactionDirection;
  transaction_type: TransactionType;
  account_reference?: string | null;
  phone_number?: string | null;
  amount: number;
  mpesa_receipt?: string | null;
  merchant_request_id?: string | null;
  checkout_request_id?: string | null;
  status?: TransactionStatus;
  description?: string | null;
  raw_payload?: any;
}) {
  const adminSupabase = createAdminClient(); // Webhooks/API endpoints use admin permission to securely write
  
  let sourceId: string | null = null;
  if (tx.account_reference) {
    sourceId = await resolveSourceId(tx.account_reference);
  }

  const { data, error } = await adminSupabase
    .from('transactions')
    .insert({
      direction: tx.direction,
      transaction_type: tx.transaction_type,
      source_id: sourceId,
      account_reference: tx.account_reference || null,
      phone_number: tx.phone_number || null,
      amount: tx.amount,
      mpesa_receipt: tx.mpesa_receipt || null,
      merchant_request_id: tx.merchant_request_id || null,
      checkout_request_id: tx.checkout_request_id || null,
      status: tx.status || 'PENDING',
      description: tx.description || null,
      raw_payload: tx.raw_payload || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert transaction:', error);
    throw error;
  }

  return data;
}

// Update transaction status (for callbacks/status queries)
export async function updateTransactionStatus(
  receiptOrId: { mpesa_receipt?: string; checkout_request_id?: string; id?: string },
  status: TransactionStatus,
  description?: string,
  rawPayload?: any
) {
  const adminSupabase = createAdminClient();
  let query = adminSupabase.from('transactions').update({
    status,
    description,
    raw_payload: rawPayload,
    updated_at: new Date().toISOString(),
  });

  if (receiptOrId.id) {
    query = query.eq('id', receiptOrId.id);
  } else if (receiptOrId.mpesa_receipt) {
    query = query.eq('mpesa_receipt', receiptOrId.mpesa_receipt);
  } else if (receiptOrId.checkout_request_id) {
    query = query.eq('checkout_request_id', receiptOrId.checkout_request_id);
  } else {
    throw new Error('Must provide either id, mpesa_receipt, or checkout_request_id');
  }

  const { data, error } = await query.select();
  if (error) {
    console.error('Failed to update transaction status:', error);
    throw error;
  }
  return data;
}

// Fetch stats for the dashboard summary cards
export async function getDashboardStats() {
  const supabase = await createClient();
  
  // Get latest balance snapshot
  const { data: balanceData } = await supabase
    .from('balance_snapshots')
    .select('balance, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const balance = balanceData?.balance || 0;
  const lastRefresh = balanceData?.fetched_at || null;

  // Calculate boundaries for "Today" in UTC+3 (or local calendar date)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Fetch all transactions since today in a single query
  const { data: todayTxs, error: txError } = await supabase
    .from('transactions')
    .select('amount, direction, source_system, status, transaction_type')
    .gte('created_at', todayISO);

  if (txError) {
    console.error('Failed to fetch today transactions for dashboard:', txError);
  }

  const txList = todayTxs || [];

  const incomingToday = txList
    .filter((tx: any) => tx.direction === 'IN' && tx.status === 'SUCCESS')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

  const outgoingToday = txList
    .filter((tx: any) => tx.direction === 'OUT' && tx.status === 'SUCCESS')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

  const netFlow = incomingToday - outgoingToday;

  const stksToday = txList.filter((tx: any) => tx.transaction_type === 'STK').length;
  const reversalsToday = txList.filter((tx: any) => tx.transaction_type === 'REVERSAL').length;

  const pesatrixInToday = txList
    .filter((tx: any) => tx.source_system === 'pesatrix' && tx.direction === 'IN' && tx.status === 'SUCCESS')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

  const pesatrixOutToday = txList
    .filter((tx: any) => tx.source_system === 'pesatrix' && tx.direction === 'OUT' && tx.status === 'SUCCESS')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

  const bingwaoneInToday = txList
    .filter((tx: any) => (tx.source_system === 'bingwaone' || tx.source_system === 'bingwazone') && tx.direction === 'IN' && tx.status === 'SUCCESS')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

  const bingwaoneOutToday = txList
    .filter((tx: any) => (tx.source_system === 'bingwaone' || tx.source_system === 'bingwazone') && tx.direction === 'OUT' && tx.status === 'SUCCESS')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

  return {
    balance,
    lastRefresh,
    incomingToday,
    outgoingToday,
    netFlow,
    stksToday,
    reversalsToday,
    pesatrixInToday,
    pesatrixOutToday,
    bingwaoneInToday,
    bingwaoneOutToday
  };
}

