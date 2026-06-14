import { createClient } from '../supabase/server';

// Get calendar bounds aligned with Africa/Nairobi time (UTC+3)
export function getPeriodBounds(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  const NAIROBI_OFFSET = 3 * 60 * 60 * 1000;
  const nairobiNow = new Date(now.getTime() + NAIROBI_OFFSET);

  let start: Date;
  let end: Date = now;
  let prevStart: Date;
  let prevEnd: Date;

  const p = period.toLowerCase();

  if (p === 'today') {
    const todayStartNairobi = new Date(nairobiNow);
    todayStartNairobi.setUTCHours(0, 0, 0, 0);
    start = new Date(todayStartNairobi.getTime() - NAIROBI_OFFSET);
    end = now;

    prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    prevEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  } else if (p === 'week') {
    const startOfWeekNairobi = new Date(nairobiNow);
    const day = startOfWeekNairobi.getUTCDay();
    startOfWeekNairobi.setUTCDate(startOfWeekNairobi.getUTCDate() - day);
    startOfWeekNairobi.setUTCHours(0, 0, 0, 0);

    start = new Date(startOfWeekNairobi.getTime() - NAIROBI_OFFSET);
    end = now;

    prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    prevEnd = start;
  } else if (p === 'month') {
    const startOfMonthNairobi = new Date(nairobiNow);
    startOfMonthNairobi.setUTCDate(1);
    startOfMonthNairobi.setUTCHours(0, 0, 0, 0);

    start = new Date(startOfMonthNairobi.getTime() - NAIROBI_OFFSET);
    end = now;

    const prevMonthNairobi = new Date(startOfMonthNairobi);
    prevMonthNairobi.setUTCMonth(prevMonthNairobi.getUTCMonth() - 1);
    prevStart = new Date(prevMonthNairobi.getTime() - NAIROBI_OFFSET);
    prevEnd = start;
  } else if (p === '30days') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = now;

    prevStart = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);
    prevEnd = start;
  } else if (p === 'custom' && customStart) {
    const sDate = new Date(customStart + 'T00:00:00+03:00');
    const eDate = customEnd ? new Date(customEnd + 'T23:59:59+03:00') : now;

    start = isNaN(sDate.getTime()) ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) : sDate;
    end = isNaN(eDate.getTime()) ? now : eDate;

    const duration = end.getTime() - start.getTime();
    prevStart = new Date(start.getTime() - duration);
    prevEnd = start;
  } else {
    // Default to 30 days
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = now;

    prevStart = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);
    prevEnd = start;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString()
  };
}

export function calculatePctChange(current: number, previous: number): string {
  if (previous === 0) {
    if (current > 0) return 'New';
    if (current < 0) return 'New';
    return 'No change';
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const prefix = pct > 0 ? '+' : '';
  return `${prefix}${pct.toFixed(1)}%`;
}

// 1. Get high-level overview metrics for parent cards
export async function getServicesOverview(period: string, customStart?: string, customEnd?: string) {
  const { start, end, prevStart, prevEnd } = getPeriodBounds(period, customStart, customEnd);
  const supabase = await createClient();

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('amount, direction, source_system, occurred_at, created_at')
    .in('source_system', ['bingwaone', 'bingwazone', 'pesatrix'])
    .eq('status', 'SUCCESS')
    .gte('occurred_at', prevStart)
    .lte('occurred_at', end);

  if (error) {
    console.error('[services-analytics] getServicesOverview failed:', error);
    throw error;
  }

  const txList = txs || [];

  const getStats = (list: any[], sysFilters: string[], startStr: string, endStr: string) => {
    const periodList = list.filter(t => {
      const ts = t.occurred_at || t.created_at;
      return sysFilters.includes(t.source_system) && ts >= startStr && ts <= endStr;
    });

    const incoming = periodList
      .filter(t => t.direction === 'IN')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const outgoing = periodList
      .filter(t => t.direction === 'OUT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const count = periodList.length;
    const incomingCount = periodList.filter(t => t.direction === 'IN').length;
    const avgIncoming = incomingCount > 0 ? incoming / incomingCount : 0;

    // Get last transaction occurred_at
    const sorted = [...periodList].sort((a, b) => {
      const tA = a.occurred_at || a.created_at;
      const tB = b.occurred_at || b.created_at;
      return tB.localeCompare(tA);
    });
    const lastTime = sorted.length > 0 ? sorted[0].occurred_at || sorted[0].created_at : null;

    return {
      incoming,
      outgoing,
      netFlow: incoming - outgoing,
      count,
      avgIncoming,
      lastTime
    };
  };

  const b1Sys = ['bingwaone', 'bingwazone'];
  const ptSys = ['pesatrix'];

  const b1Current = getStats(txList, b1Sys, start, end);
  const b1Prev = getStats(txList, b1Sys, prevStart, prevEnd);

  const ptCurrent = getStats(txList, ptSys, start, end);
  const ptPrev = getStats(txList, ptSys, prevStart, prevEnd);

  return {
    bingwaone: {
      current: b1Current,
      change: {
        incoming: calculatePctChange(b1Current.incoming, b1Prev.incoming),
        outgoing: calculatePctChange(b1Current.outgoing, b1Prev.outgoing),
        netFlow: calculatePctChange(b1Current.netFlow, b1Prev.netFlow),
        count: calculatePctChange(b1Current.count, b1Prev.count),
        avgIncoming: calculatePctChange(b1Current.avgIncoming, b1Prev.avgIncoming)
      }
    },
    pesatrix: {
      current: ptCurrent,
      change: {
        incoming: calculatePctChange(ptCurrent.incoming, ptPrev.incoming),
        outgoing: calculatePctChange(ptCurrent.outgoing, ptPrev.outgoing),
        netFlow: calculatePctChange(ptCurrent.netFlow, ptPrev.netFlow),
        count: calculatePctChange(ptCurrent.count, ptPrev.count),
        avgIncoming: calculatePctChange(ptCurrent.avgIncoming, ptPrev.avgIncoming)
      }
    }
  };
}

// 2. Dynamic BingwaOne Module Summaries
export async function getBingwaOneModuleSummaries(period: string, customStart?: string, customEnd?: string) {
  const { start, end, prevStart, prevEnd } = getPeriodBounds(period, customStart, customEnd);
  const supabase = await createClient();

  // Distinct non-empty active modules across database
  const { data: moduleData } = await supabase
    .from('transactions')
    .select('module')
    .in('source_system', ['bingwaone', 'bingwazone'])
    .eq('status', 'SUCCESS')
    .not('module', 'is', null);

  const modulesSet = new Set<string>();
  ((moduleData || []) as any[]).forEach((row: any) => {
    const m = row.module?.trim();
    if (m && m !== '' && m.toLowerCase() !== 'null' && m.toLowerCase() !== 'undefined') {
      modulesSet.add(m);
    }
  });
  const uniqueModules = Array.from(modulesSet);

  if (uniqueModules.length === 0) {
    return { modules: [], totalBingwaOneIncoming: 0 };
  }

  // Fetch all transactions in the relevant date ranges
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('amount, direction, module, payment_type, transaction_type, occurred_at, created_at')
    .in('source_system', ['bingwaone', 'bingwazone'])
    .eq('status', 'SUCCESS')
    .gte('occurred_at', prevStart)
    .lte('occurred_at', end);

  if (error) {
    console.error('[services-analytics] getBingwaOneModuleSummaries failed:', error);
    throw error;
  }

  const txList = txs || [];

  const filterList = (list: any[], startStr: string, endStr: string) => {
    return list.filter(t => {
      const ts = t.occurred_at || t.created_at;
      return ts >= startStr && ts <= endStr;
    });
  };

  const currentTxs = filterList(txList, start, end);
  const prevTxs = filterList(txList, prevStart, prevEnd);

  // Total BingwaOne incoming revenue (current period)
  const totalB1Incoming = currentTxs
    .filter(t => t.direction === 'IN')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const moduleSummaries = uniqueModules.map(moduleName => {
    const getModuleStats = (list: any[]) => {
      const modList = list.filter(t => t.module === moduleName);
      const incoming = modList
        .filter(t => t.direction === 'IN')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const outgoing = modList
        .filter(t => t.direction === 'OUT')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const count = modList.length;
      const incomingCount = modList.filter(t => t.direction === 'IN').length;
      const avgIncoming = incomingCount > 0 ? incoming / incomingCount : 0;

      // Find last transaction occurred_at
      const sorted = [...modList].sort((a, b) => {
        const tA = a.occurred_at || a.created_at;
        const tB = b.occurred_at || b.created_at;
        return tB.localeCompare(tA);
      });
      const lastTime = sorted.length > 0 ? sorted[0].occurred_at || sorted[0].created_at : null;

      // Most common payment type
      const paymentTypes: Record<string, number> = {};
      modList.forEach(t => {
        const pt = t.payment_type || t.transaction_type || 'unknown';
        paymentTypes[pt] = (paymentTypes[pt] || 0) + 1;
      });
      let mostCommonPaymentType = '—';
      let maxCount = 0;
      Object.entries(paymentTypes).forEach(([pt, cnt]) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          mostCommonPaymentType = pt;
        }
      });

      return {
        incoming,
        outgoing,
        netFlow: incoming - outgoing,
        count,
        avgIncoming,
        lastTime,
        mostCommonPaymentType
      };
    };

    const currentStats = getModuleStats(currentTxs);
    const prevStats = getModuleStats(prevTxs);

    const pctOfTotal = totalB1Incoming > 0 ? (currentStats.incoming / totalB1Incoming) * 100 : 0;

    return {
      module: moduleName,
      incoming: currentStats.incoming,
      outgoing: currentStats.outgoing,
      netFlow: currentStats.netFlow,
      count: currentStats.count,
      avgIncoming: currentStats.avgIncoming,
      lastTime: currentStats.lastTime,
      mostCommonPaymentType: currentStats.mostCommonPaymentType,
      pctOfTotal,
      change: calculatePctChange(currentStats.incoming, prevStats.incoming)
    };
  });

  // Sort modules by incoming revenue descending
  moduleSummaries.sort((a, b) => b.incoming - a.incoming);

  return {
    modules: moduleSummaries,
    totalBingwaOneIncoming: totalB1Incoming
  };
}

// Helper to bucket chart data
function bucketTransactionsForChart(txs: any[], period: string, startStr: string, endStr: string) {
  const chartData: any[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  const NAIROBI_OFFSET = 3 * 60 * 60 * 1000;

  const getLocalDateString = (d: Date) => {
    const nairobiDate = new Date(d.getTime() + NAIROBI_OFFSET);
    return nairobiDate.toISOString().slice(0, 10);
  };

  const getLocalHourString = (d: Date) => {
    const nairobiDate = new Date(d.getTime() + NAIROBI_OFFSET);
    return `${String(nairobiDate.getUTCHours()).padStart(2, '0')}:00`;
  };

  const p = period.toLowerCase();

  if (p === 'today') {
    for (let h = 0; h < 24; h++) {
      const hourLabel = `${String(h).padStart(2, '0')}:00`;
      chartData.push({ label: hourLabel, incoming: 0, outgoing: 0, count: 0 });
    }

    txs.forEach(t => {
      const ts = new Date(t.occurred_at || t.created_at);
      const hourStr = getLocalHourString(ts);
      const bucket = chartData.find(item => item.label === hourStr);
      if (bucket) {
        const amt = Number(t.amount);
        if (t.direction === 'IN') bucket.incoming += amt;
        else bucket.outgoing += amt;
        bucket.count++;
      }
    });
  } else {
    const dateMap: Record<string, { label: string; incoming: number; outgoing: number; count: number }> = {};
    const durationDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);

    if (durationDays > 45) {
      // Group Weekly
      const temp = new Date(start.getTime());
      while (temp <= end) {
        const dateLabel = `Wk ${temp.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', timeZone: 'Africa/Nairobi' })}`;
        const key = getLocalDateString(temp);
        dateMap[key] = { label: dateLabel, incoming: 0, outgoing: 0, count: 0 };
        temp.setDate(temp.getDate() + 7);
      }

      txs.forEach(t => {
        const ts = new Date(t.occurred_at || t.created_at);
        // Find closest week start bucket
        let closestKey = '';
        let minDiff = Infinity;
        Object.keys(dateMap).forEach(k => {
          const kDate = new Date(k);
          const diff = Math.abs(ts.getTime() - kDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestKey = k;
          }
        });

        if (closestKey && dateMap[closestKey]) {
          const amt = Number(t.amount);
          if (t.direction === 'IN') dateMap[closestKey].incoming += amt;
          else dateMap[closestKey].outgoing += amt;
          dateMap[closestKey].count++;
        }
      });
      chartData.push(...Object.values(dateMap));
    } else {
      // Group Daily
      const temp = new Date(start.getTime());
      while (temp <= end) {
        const dateLabel = temp.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', timeZone: 'Africa/Nairobi' });
        const key = getLocalDateString(temp);
        dateMap[key] = { label: dateLabel, incoming: 0, outgoing: 0, count: 0 };
        temp.setDate(temp.getDate() + 1);
      }

      txs.forEach(t => {
        const ts = new Date(t.occurred_at || t.created_at);
        const key = getLocalDateString(ts);
        if (dateMap[key]) {
          const amt = Number(t.amount);
          if (t.direction === 'IN') dateMap[key].incoming += amt;
          else dateMap[key].outgoing += amt;
          dateMap[key].count++;
        }
      });
      chartData.push(...Object.values(dateMap));
    }
  }

  return chartData;
}

// 3. Dynamic Module Details Modal View
export async function getBingwaOneModuleDetails(moduleName: string, period: string, customStart?: string, customEnd?: string) {
  const { start, end, prevStart, prevEnd } = getPeriodBounds(period, customStart, customEnd);
  const supabase = await createClient();

  // Query transactions for total incoming calculations
  const { data: totalIncomingTxs } = await supabase
    .from('transactions')
    .select('amount')
    .in('source_system', ['bingwaone', 'bingwazone'])
    .eq('direction', 'IN')
    .eq('status', 'SUCCESS')
    .gte('occurred_at', start)
    .lte('occurred_at', end);

  const totalBingwaOneIncoming = ((totalIncomingTxs || []) as any[]).reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  // Fetch all transactions for this specific module in both current and previous ranges
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .in('source_system', ['bingwaone', 'bingwazone'])
    .eq('module', moduleName)
    .eq('status', 'SUCCESS')
    .gte('occurred_at', prevStart)
    .lte('occurred_at', end)
    .order('occurred_at', { ascending: false });

  if (error) {
    console.error(`[services-analytics] getBingwaOneModuleDetails for ${moduleName} failed:`, error);
    throw error;
  }

  const txList = txs || [];

  const filterList = (list: any[], startStr: string, endStr: string) => {
    return list.filter(t => {
      const ts = t.occurred_at || t.created_at;
      return ts >= startStr && ts <= endStr;
    });
  };

  const currentTxs = filterList(txList, start, end);
  const prevTxs = filterList(txList, prevStart, prevEnd);

  // High-level aggregates
  const incoming = currentTxs.filter(t => t.direction === 'IN').reduce((sum, t) => sum + Number(t.amount), 0);
  const outgoing = currentTxs.filter(t => t.direction === 'OUT').reduce((sum, t) => sum + Number(t.amount), 0);
  const count = currentTxs.length;
  const incomingCount = currentTxs.filter(t => t.direction === 'IN').length;
  const avgIncoming = incomingCount > 0 ? incoming / incomingCount : 0;

  const prevIncoming = prevTxs.filter(t => t.direction === 'IN').reduce((sum, t) => sum + Number(t.amount), 0);
  const prevOutgoing = prevTxs.filter(t => t.direction === 'OUT').reduce((sum, t) => sum + Number(t.amount), 0);
  const prevCount = prevTxs.length;
  const prevIncomingCount = prevTxs.filter(t => t.direction === 'IN').length;
  const prevAvgIncoming = prevIncomingCount > 0 ? prevIncoming / prevIncomingCount : 0;

  // Highest / lowest incoming transaction amount
  const incomingAmounts = currentTxs.filter(t => t.direction === 'IN').map(t => Number(t.amount));
  const highestIncoming = incomingAmounts.length > 0 ? Math.max(...incomingAmounts) : 0;
  const lowestIncoming = incomingAmounts.length > 0 ? Math.min(...incomingAmounts) : 0;

  // First and latest transaction timestamps
  const sortedCurrent = [...currentTxs].sort((a, b) => {
    const tA = a.occurred_at || a.created_at;
    const tB = b.occurred_at || b.created_at;
    return tA.localeCompare(tB);
  });
  const firstTxTime = sortedCurrent.length > 0 ? sortedCurrent[0].occurred_at || sortedCurrent[0].created_at : null;
  const latestTxTime = sortedCurrent.length > 0 ? sortedCurrent[sortedCurrent.length - 1].occurred_at || sortedCurrent[sortedCurrent.length - 1].created_at : null;

  // Contribution percentage of total BingwaOne revenue
  const pctOfTotal = totalBingwaOneIncoming > 0 ? (incoming / totalBingwaOneIncoming) * 100 : 0;

  // Time series chart data
  const chartData = bucketTransactionsForChart(currentTxs, period, start, end);

  // Group transactions dynamically by payment_type
  const paymentTypesMap: Record<string, { incoming: number; count: number; prevIncoming: number }> = {};

  currentTxs.forEach(t => {
    const pt = t.payment_type || t.transaction_type || 'unknown';
    if (!paymentTypesMap[pt]) {
      paymentTypesMap[pt] = { incoming: 0, count: 0, prevIncoming: 0 };
    }
    if (t.direction === 'IN') {
      paymentTypesMap[pt].incoming += Number(t.amount);
    }
    paymentTypesMap[pt].count++;
  });

  prevTxs.forEach(t => {
    const pt = t.payment_type || t.transaction_type || 'unknown';
    if (!paymentTypesMap[pt]) {
      paymentTypesMap[pt] = { incoming: 0, count: 0, prevIncoming: 0 };
    }
    if (t.direction === 'IN') {
      paymentTypesMap[pt].prevIncoming += Number(t.amount);
    }
  });

  const paymentTypeBreakdown = Object.entries(paymentTypesMap).map(([type, stats]) => {
    const avg = stats.count > 0 ? stats.incoming / stats.count : 0;
    const pct = incoming > 0 ? (stats.incoming / incoming) * 100 : 0;
    return {
      paymentType: type,
      incoming: stats.incoming,
      count: stats.count,
      avg,
      pct,
      change: calculatePctChange(stats.incoming, stats.prevIncoming)
    };
  }).sort((a, b) => b.incoming - a.incoming);

  // Recent transactions list
  const recentTransactions = currentTxs.slice(0, 15);

  // Top Agents aggregations
  const agentsMap: Record<string, { name: string; username: string; volume: number; count: number }> = {};
  currentTxs.forEach(t => {
    if (t.direction === 'IN') {
      const agentKey = t.agent_username || t.agent_name;
      if (agentKey) {
        if (!agentsMap[agentKey]) {
          agentsMap[agentKey] = {
            name: t.agent_name || t.agent_username || 'Unknown',
            username: t.agent_username || '',
            volume: 0,
            count: 0
          };
        }
        agentsMap[agentKey].volume += Number(t.amount);
        agentsMap[agentKey].count++;
      }
    }
  });

  const agentsList = Object.values(agentsMap);
  const topAgentsByVolume = [...agentsList].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const topAgentsByCount = [...agentsList].sort((a, b) => b.count - a.count).slice(0, 5);

  return {
    module: moduleName,
    metrics: {
      incoming,
      outgoing,
      netFlow: incoming - outgoing,
      count,
      avgIncoming,
      highestIncoming,
      lowestIncoming,
      firstTxTime,
      latestTxTime,
      pctOfTotal,
      change: {
        incoming: calculatePctChange(incoming, prevIncoming),
        outgoing: calculatePctChange(outgoing, prevOutgoing),
        netFlow: calculatePctChange(incoming - outgoing, prevIncoming - prevOutgoing),
        count: calculatePctChange(count, prevCount),
        avgIncoming: calculatePctChange(avgIncoming, prevAvgIncoming)
      }
    },
    chartData,
    paymentTypeBreakdown,
    recentTransactions,
    topAgentsByVolume,
    topAgentsByCount
  };
}

// 4. Pesatrix Overview Stats
export async function getPesatrixOverview(period: string, customStart?: string, customEnd?: string) {
  const { start, end, prevStart, prevEnd } = getPeriodBounds(period, customStart, customEnd);
  const supabase = await createClient();

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('amount, direction, transaction_type, occurred_at, created_at')
    .eq('source_system', 'pesatrix')
    .eq('status', 'SUCCESS')
    .gte('occurred_at', prevStart)
    .lte('occurred_at', end);

  if (error) {
    console.error('[services-analytics] getPesatrixOverview failed:', error);
    throw error;
  }

  const txList = txs || [];

  const getStats = (list: any[], startStr: string, endStr: string) => {
    const periodList = list.filter(t => {
      const ts = t.occurred_at || t.created_at;
      return ts >= startStr && ts <= endStr;
    });

    const currentIncomingList = periodList.filter(t => t.direction === 'IN' || t.transaction_type === 'activation');
    const activationRevenue = currentIncomingList.reduce((sum, t) => sum + Number(t.amount), 0);
    const activationCount = currentIncomingList.length;
    const avgActivation = activationCount > 0 ? activationRevenue / activationCount : 0;

    const sortedActivations = [...currentIncomingList].sort((a, b) => {
      const tA = a.occurred_at || a.created_at;
      const tB = b.occurred_at || b.created_at;
      return tB.localeCompare(tA);
    });
    const latestActivationTime = sortedActivations.length > 0 ? sortedActivations[0].occurred_at || sortedActivations[0].created_at : null;

    const currentOutgoingList = periodList.filter(t => t.direction === 'OUT' || t.transaction_type === 'withdrawal');
    const withdrawalOutflow = currentOutgoingList.reduce((sum, t) => sum + Number(t.amount), 0);
    const withdrawalCount = currentOutgoingList.length;
    const avgWithdrawal = withdrawalCount > 0 ? withdrawalOutflow / withdrawalCount : 0;

    const sortedWithdrawals = [...currentOutgoingList].sort((a, b) => {
      const tA = a.occurred_at || a.created_at;
      const tB = b.occurred_at || b.created_at;
      return tB.localeCompare(tA);
    });
    const latestWithdrawalTime = sortedWithdrawals.length > 0 ? sortedWithdrawals[0].occurred_at || sortedWithdrawals[0].created_at : null;

    const totalVolume = activationRevenue + withdrawalOutflow;
    const netFlow = activationRevenue - withdrawalOutflow;
    const totalCount = periodList.length;

    // Withdrawal-to-activation ratio
    const withdrawalToActivationRatio = activationRevenue > 0 ? (withdrawalOutflow / activationRevenue) * 100 : 0;

    return {
      activationRevenue,
      activationCount,
      avgActivation,
      latestActivationTime,
      withdrawalOutflow,
      withdrawalCount,
      avgWithdrawal,
      latestWithdrawalTime,
      totalVolume,
      netFlow,
      totalCount,
      withdrawalToActivationRatio
    };
  };

  const current = getStats(txList, start, end);
  const prev = getStats(txList, prevStart, prevEnd);

  return {
    activation: {
      revenue: current.activationRevenue,
      count: current.activationCount,
      avgAmount: current.avgActivation,
      latestTime: current.latestActivationTime,
      pctOfTotalIncoming: 100, // For Pesatrix, activations are 100% of incoming
      change: calculatePctChange(current.activationRevenue, prev.activationRevenue),
      countChange: calculatePctChange(current.activationCount, prev.activationCount)
    },
    withdrawal: {
      outflow: current.withdrawalOutflow,
      count: current.withdrawalCount,
      avgAmount: current.avgWithdrawal,
      latestTime: current.latestWithdrawalTime,
      pctOfTotalOutgoing: 100, // withdrawals are 100% of outflow
      change: calculatePctChange(current.withdrawalOutflow, prev.withdrawalOutflow),
      countChange: calculatePctChange(current.withdrawalCount, prev.withdrawalCount)
    },
    summary: {
      activationIncome: current.activationRevenue,
      withdrawalOutflow: current.withdrawalOutflow,
      netFlow: current.netFlow,
      activationCount: current.activationCount,
      withdrawalCount: current.withdrawalCount,
      withdrawalToActivationRatio: current.withdrawalToActivationRatio,
      change: {
        netFlow: calculatePctChange(current.netFlow, prev.netFlow)
      }
    }
  };
}

// 5. Pesatrix Event Details Modal (for Activations or Withdrawals card click)
export async function getPesatrixEventDetails(eventType: 'activation' | 'withdrawal', period: string, customStart?: string, customEnd?: string) {
  const { start, end, prevStart, prevEnd } = getPeriodBounds(period, customStart, customEnd);
  const supabase = await createClient();

  const isIncoming = eventType === 'activation';

  // Fetch all transactions matching filter
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('source_system', 'pesatrix')
    .eq('direction', isIncoming ? 'IN' : 'OUT')
    .eq('status', 'SUCCESS')
    .gte('occurred_at', prevStart)
    .lte('occurred_at', end)
    .order('occurred_at', { ascending: false });

  if (error) {
    console.error(`[services-analytics] getPesatrixEventDetails for ${eventType} failed:`, error);
    throw error;
  }

  const txList = txs || [];

  const filterList = (list: any[], startStr: string, endStr: string) => {
    return list.filter(t => {
      const ts = t.occurred_at || t.created_at;
      return ts >= startStr && ts <= endStr;
    });
  };

  const currentTxs = filterList(txList, start, end);
  const prevTxs = filterList(txList, prevStart, prevEnd);

  // Calculations
  const currentVolume = currentTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const currentCount = currentTxs.length;
  const currentAvg = currentCount > 0 ? currentVolume / currentCount : 0;

  const prevVolume = prevTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const prevCount = prevTxs.length;
  const prevAvg = prevCount > 0 ? prevVolume / prevCount : 0;

  // Highest / lowest amounts
  const amounts = currentTxs.map(t => Number(t.amount));
  const highest = amounts.length > 0 ? Math.max(...amounts) : 0;
  const lowest = amounts.length > 0 ? Math.min(...amounts) : 0;

  // Time series trend data
  const trendData = bucketTransactionsForChart(currentTxs, period, start, end);

  // Recent transactions list
  const recentTransactions = currentTxs.slice(0, 15);

  return {
    eventType,
    metrics: {
      volume: currentVolume,
      count: currentCount,
      avgAmount: currentAvg,
      highestAmount: highest,
      lowestAmount: lowest,
      change: {
        volume: calculatePctChange(currentVolume, prevVolume),
        count: calculatePctChange(currentCount, prevCount),
        avgAmount: calculatePctChange(currentAvg, prevAvg)
      }
    },
    trendData,
    recentTransactions
  };
}
