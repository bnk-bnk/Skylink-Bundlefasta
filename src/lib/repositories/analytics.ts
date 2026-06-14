import { createClient } from '../supabase/server';
import { getReadableLabel } from '../utils/labels';

export async function getAnalyticsData() {
  const supabase = await createClient();

  // Fetch past 30 days transactions
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      *,
      product_sources (
        id,
        name,
        reference
      )
    `)
    .gte('created_at', thirtyDaysAgoISO);

  // Fetch balance snapshots
  const { data: snapshots } = await supabase
    .from('balance_snapshots')
    .select('*')
    .gte('fetched_at', thirtyDaysAgoISO)
    .order('fetched_at', { ascending: true });

  if (error || !transactions) {
    console.error('Error fetching analytics transactions:', error);
    return getEmptyAnalytics();
  }

  const txList = transactions || [];
  const balanceTrend = (snapshots || []).map((snap: any) => ({
    date: new Date(snap.fetched_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
    balance: Number(snap.balance),
  }));

  // Date range calculations
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfWeekTime = startOfWeek.getTime();

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  let revenueToday = 0;
  let revenueWeek = 0;
  let revenueMonth = 0;
  let revenueYear = 0;

  // Revenue by Day (last 7 days) & Cashflow by Day (including BingwaOne / Pesatrix)
  const dailyDataMap: { [date: string]: { date: string; revenue: number; inflow: number; outflow: number; bingwaoneInflow: number; pesatrixInflow: number; bingwaoneOutflow: number; pesatrixOutflow: number } } = {};
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
    dailyDataMap[dateStr] = { 
      date: dateStr, 
      revenue: 0, 
      inflow: 0, 
      outflow: 0,
      bingwaoneInflow: 0,
      pesatrixInflow: 0,
      bingwaoneOutflow: 0,
      pesatrixOutflow: 0
    };
  }

  // Source mapping
  const sourceMap: { [name: string]: number } = {};
  const referenceMap: { [ref: string]: { name: string; value: number } } = {};
  const phoneMap: { [phone: string]: number } = {};
  const moduleMap: { [mod: string]: number } = {};

  // Success rate counts
  let stkSuccess = 0, stkTotal = 0;
  let b2cSuccess = 0, b2cTotal = 0;
  let reversalSuccess = 0, reversalTotal = 0;

  txList.forEach((tx: any) => {
    const amount = Number(tx.amount);
    const txTime = new Date(tx.created_at).getTime();
    const dateStr = new Date(tx.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });

    // Success rates
    if (tx.transaction_type === 'STK') {
      stkTotal++;
      if (tx.status === 'SUCCESS') stkSuccess++;
    } else if (tx.transaction_type === 'B2C') {
      b2cTotal++;
      if (tx.status === 'SUCCESS') b2cSuccess++;
    } else if (tx.transaction_type === 'REVERSAL') {
      reversalTotal++;
      if (tx.status === 'SUCCESS') reversalSuccess++;
    }

    if (tx.status !== 'SUCCESS') return; // Accumulate financial stats only for SUCCESS transactions

    // Revenue aggregations (direction = 'IN')
    if (tx.direction === 'IN') {
      if (txTime >= startOfDay) revenueToday += amount;
      if (txTime >= startOfWeekTime) revenueWeek += amount;
      if (txTime >= startOfMonth) revenueMonth += amount;
      if (txTime >= startOfYear) revenueYear += amount;

      // Group by daily revenue & cashflow
      if (dailyDataMap[dateStr]) {
        dailyDataMap[dateStr].revenue += amount;
        dailyDataMap[dateStr].inflow += amount;
        if (tx.source_system === 'bingwaone' || tx.source_system === 'bingwazone') {
          dailyDataMap[dateStr].bingwaoneInflow += amount;
        } else if (tx.source_system === 'pesatrix') {
          dailyDataMap[dateStr].pesatrixInflow += amount;
        }
      }

      // Source distribution
      const sourceName = (tx.source_system === 'bingwaone' || tx.source_system === 'bingwazone') ? 'BingwaOne' : tx.source_system === 'pesatrix' ? 'Pesatrix' : getReadableLabel(tx.product_sources?.name || tx.source_system || 'Manual');
      sourceMap[sourceName] = (sourceMap[sourceName] || 0) + amount;

      // Module distribution
      if (tx.module) {
        moduleMap[tx.module] = (moduleMap[tx.module] || 0) + amount;
      }

      // Reference aggregations
      const ref = tx.account_reference || 'UNKNOWN';
      if (!referenceMap[ref]) {
        referenceMap[ref] = { name: ref, value: 0 };
      }
      referenceMap[ref].value += amount;
    } else if (tx.direction === 'OUT') {
      // Group by daily outflow
      if (dailyDataMap[dateStr]) {
        dailyDataMap[dateStr].outflow += amount;
        if (tx.source_system === 'bingwaone' || tx.source_system === 'bingwazone') {
          dailyDataMap[dateStr].bingwaoneOutflow += amount;
        } else if (tx.source_system === 'pesatrix') {
          dailyDataMap[dateStr].pesatrixOutflow += amount;
        }
      }
    }

    // Phone numbers (all successful transactions involving phones)
    if (tx.phone_number) {
      phoneMap[tx.phone_number] = (phoneMap[tx.phone_number] || 0) + amount;
    }
  });

  // Convert daily maps to arrays
  const revenueTrend = Object.values(dailyDataMap);
  const cashflowTrend = Object.values(dailyDataMap).map(d => ({
    date: d.date,
    inflow: d.inflow,
    outflow: d.outflow,
    net: d.inflow - d.outflow,
    bingwaoneVolume: d.bingwaoneInflow + d.bingwaoneOutflow,
    pesatrixVolume: d.pesatrixInflow + d.pesatrixOutflow,
    bingwaoneInflow: d.bingwaoneInflow,
    pesatrixInflow: d.pesatrixInflow,
    bingwaoneOutflow: d.bingwaoneOutflow,
    pesatrixOutflow: d.pesatrixOutflow
  }));

  // Revenue by source dataset
  const revenueBySource = Object.entries(sourceMap).map(([name, value]) => ({
    name,
    value,
  })).sort((a, b) => b.value - a.value);

  // Module Share dataset
  const moduleShare = Object.entries(moduleMap).map(([name, value]) => ({
    name: getReadableLabel(name),
    value,
  })).sort((a, b) => b.value - a.value);

  // Top references
  const topReferences = Object.values(referenceMap)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Top phone numbers
  const topPhoneNumbers = Object.entries(phoneMap)
    .map(([phone, value]) => ({ phone, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    metrics: {
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenueYear,
    },
    charts: {
      revenueTrend,
      cashflowTrend,
      revenueBySource: revenueBySource.length > 0 ? revenueBySource : [{ name: 'No Data', value: 0 }],
      moduleShare: moduleShare.length > 0 ? moduleShare : [{ name: 'No Data', value: 0 }],
      balanceTrend: balanceTrend.length > 0 ? balanceTrend : [{ date: 'Today', balance: 0 }],
      topReferences,
      topPhoneNumbers,
      rates: {
        stkSuccessRate: stkTotal > 0 ? Math.round((stkSuccess / stkTotal) * 100) : 100,
        b2cSuccessRate: b2cTotal > 0 ? Math.round((b2cSuccess / b2cTotal) * 100) : 100,
        reversalSuccessRate: reversalTotal > 0 ? Math.round((reversalSuccess / reversalTotal) * 100) : 100,
      },
    },
  };
}

function getEmptyAnalytics() {
  return {
    metrics: { revenueToday: 0, revenueWeek: 0, revenueMonth: 0, revenueYear: 0 },
    charts: {
      revenueTrend: [],
      cashflowTrend: [],
      revenueBySource: [{ name: 'No Data', value: 0 }],
      moduleShare: [{ name: 'No Data', value: 0 }],
      balanceTrend: [{ date: 'Today', balance: 0 }],
      topReferences: [],
      topPhoneNumbers: [],
      rates: { stkSuccessRate: 100, b2cSuccessRate: 100, reversalSuccessRate: 100 },
    },
  };
}

