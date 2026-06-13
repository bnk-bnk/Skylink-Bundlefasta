'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, BarChart3, PieChart as PieIcon, ArrowUpRight, ArrowDownLeft, Calendar, Filter, RefreshCw, Layers, Award, ShieldAlert, Sparkles } from 'lucide-react';
import { getAnalyticsTransactionsAction } from '@/app/actions';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { getReadableLabel } from '@/lib/utils/labels';

const COLORS = ['#00BFFF', '#0DB02B', '#FF4500', '#FF3B30', '#6B7280', '#D000F0', '#FFCC00'];

export default function AnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'custom'>('7days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('SUCCESS'); // Default to successful transactions only

  // Computed Global KPIs
  const [globalKpis, setGlobalKpis] = useState({
    incomingVolume: 0,
    incomingVolumeDelta: 0,
    outgoingVolume: 0,
    outgoingVolumeDelta: 0,
    netFlow: 0,
    netFlowDelta: 0,
    txCount: 0,
    txCountDelta: 0,
    avgTxValue: 0,
    avgTxValueDelta: 0,
    incomingCount: 0,
    outgoingCount: 0,
    reconciliationConflicts: 0
  });

  // Source-specific stats
  const [sourceStats, setSourceStats] = useState<Record<string, any>>({});
  
  // BingwaZone module stats
  const [bzModuleStats, setBzModuleStats] = useState<any[]>([]);
  const [bzWithdrawals, setBzWithdrawals] = useState({ amount: 0, count: 0 });

  // Pesatrix specific stats
  const [pesatrixStats, setPesatrixStats] = useState({
    activationRevenue: 0,
    activationCount: 0,
    avgActivationAmount: 0,
    walletWithdrawals: 0,
    withdrawalCount: 0,
    netFlow: 0,
    withdrawalRatio: 0
  });

  // Top Agents
  const [topAgents, setTopAgents] = useState<any[]>([]);

  // Charts
  const [charts, setCharts] = useState<any>({
    timeSeries: [],
    sourceRevenue: [],
    bzModules: [],
    paymentTypes: [],
    serviceSources: [],
    reconDistribution: []
  });

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let currentStart: Date;
      let currentEnd: Date = now;
      let prevStart: Date;
      let prevEnd: Date;

      // 1. Resolve date intervals
      if (dateRange === 'today') {
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        prevStart = new Date(currentStart.getTime() - 24 * 3600 * 1000);
        prevEnd = currentStart;
      } else if (dateRange === '7days') {
        currentStart = new Date();
        currentStart.setDate(now.getDate() - 7);
        currentStart.setHours(0, 0, 0, 0);
        prevStart = new Date();
        prevStart.setDate(now.getDate() - 14);
        prevStart.setHours(0, 0, 0, 0);
        prevEnd = currentStart;
      } else if (dateRange === '30days') {
        currentStart = new Date();
        currentStart.setDate(now.getDate() - 30);
        currentStart.setHours(0, 0, 0, 0);
        prevStart = new Date();
        prevStart.setDate(now.getDate() - 60);
        prevStart.setHours(0, 0, 0, 0);
        prevEnd = currentStart;
      } else {
        currentStart = customStart ? new Date(customStart) : new Date();
        currentEnd = customEnd ? new Date(customEnd) : now;
        const duration = currentEnd.getTime() - currentStart.getTime();
        prevStart = new Date(currentStart.getTime() - duration);
        prevEnd = currentStart;
      }

      // Fetch all transactions covering current & previous period
      const rawTxs = await getAnalyticsTransactionsAction({
        dateStart: prevStart.toISOString(),
        dateEnd: currentEnd.toISOString()
      });

      // Helper function to calculate stats for a period
      const computePeriodStats = (txs: any[]) => {
        // Apply status filter if selected
        let filtered = selectedStatus ? txs.filter(t => t.status === selectedStatus) : txs;
        
        // Exclude conflict/duplicate evidence events from financial totals where required
        // Note: we exclude reconciliation_status = 'conflict' duplicates to prevent double counting
        filtered = filtered.filter(t => t.reconciliation_status !== 'conflict');

        let incomingVolume = 0;
        let outgoingVolume = 0;
        let txCount = 0;
        let incomingCount = 0;
        let outgoingCount = 0;

        filtered.forEach(t => {
          const amt = Number(t.amount);
          txCount++;
          if (t.direction === 'IN') {
            incomingVolume += amt;
            incomingCount++;
          } else {
            outgoingVolume += amt;
            outgoingCount++;
          }
        });

        const netFlow = incomingVolume - outgoingVolume;
        const avgTxValue = txCount > 0 ? (incomingVolume + outgoingVolume) / txCount : 0;

        return {
          incomingVolume,
          outgoingVolume,
          netFlow,
          txCount,
          incomingCount,
          outgoingCount,
          avgTxValue,
          txList: filtered
        };
      };

      // 2. Separate datasets
      const currentPeriodTxs = rawTxs.filter((t: any) => {
        const time = new Date(t.occurred_at || t.created_at).getTime();
        return time >= currentStart.getTime() && time <= currentEnd.getTime();
      });

      const prevPeriodTxs = rawTxs.filter((t: any) => {
        const time = new Date(t.occurred_at || t.created_at).getTime();
        return time >= prevStart.getTime() && time < currentStart.getTime();
      });

      // Calculate global metrics
      const curMetrics = computePeriodStats(currentPeriodTxs);
      const prevMetrics = computePeriodStats(prevPeriodTxs);

      // Deltas
      const incomingVolumeDelta = prevMetrics.incomingVolume > 0 ? ((curMetrics.incomingVolume - prevMetrics.incomingVolume) / prevMetrics.incomingVolume) * 100 : 0;
      const outgoingVolumeDelta = prevMetrics.outgoingVolume > 0 ? ((curMetrics.outgoingVolume - prevMetrics.outgoingVolume) / prevMetrics.outgoingVolume) * 100 : 0;
      const netFlowDelta = prevMetrics.netFlow > 0 ? ((curMetrics.netFlow - prevMetrics.netFlow) / prevMetrics.netFlow) * 100 : 0;
      const txCountDelta = prevMetrics.txCount > 0 ? ((curMetrics.txCount - prevMetrics.txCount) / prevMetrics.txCount) * 100 : 0;
      const avgTxValueDelta = prevMetrics.avgTxValue > 0 ? ((curMetrics.avgTxValue - prevMetrics.avgTxValue) / prevMetrics.avgTxValue) * 100 : 0;

      // Count reconciliation conflicts in current period (independent of status)
      const reconciliationConflicts = currentPeriodTxs.filter((t: any) => t.reconciliation_status === 'conflict').length;

      setGlobalKpis({
        incomingVolume: curMetrics.incomingVolume,
        incomingVolumeDelta,
        outgoingVolume: curMetrics.outgoingVolume,
        outgoingVolumeDelta,
        netFlow: curMetrics.netFlow,
        netFlowDelta,
        txCount: curMetrics.txCount,
        txCountDelta,
        avgTxValue: curMetrics.avgTxValue,
        avgTxValueDelta,
        incomingCount: curMetrics.incomingCount,
        outgoingCount: curMetrics.outgoingCount,
        reconciliationConflicts
      });

      // 3. Source system comparisons (BingwaZone vs Pesatrix vs Unknown)
      const sourcesList = ['bingwazone', 'pesatrix', 'unknown'];
      const sourcesData: Record<string, any> = {};

      sourcesList.forEach(src => {
        const curSrc = curMetrics.txList.filter(t => t.source_system === src);
        const prevSrc = prevMetrics.txList.filter(t => t.source_system === src);

        let curIn = 0, curOut = 0, curCnt = 0;
        curSrc.forEach(t => {
          curCnt++;
          if (t.direction === 'IN') curIn += Number(t.amount);
          else curOut += Number(t.amount);
        });

        let prevIn = 0;
        prevSrc.forEach(t => {
          if (t.direction === 'IN') prevIn += Number(t.amount);
        });

        const pct = curMetrics.incomingVolume > 0 ? (curIn / curMetrics.incomingVolume) * 100 : 0;
        const change = prevIn > 0 ? ((curIn - prevIn) / prevIn) * 100 : 0;

        sourcesData[src] = {
          incoming: curIn,
          outgoing: curOut,
          net: curIn - curOut,
          count: curCnt,
          percentage: pct,
          delta: change
        };
      });
      setSourceStats(sourcesData);

      // 4. BingwaZone Modules Dissection
      const curBz = curMetrics.txList.filter(t => t.source_system === 'bingwazone');
      const prevBz = prevMetrics.txList.filter(t => t.source_system === 'bingwazone');

      const bzModules = ['mini_site', 'whatsapp_bot', 'whatsapp_agents', 'whatsapp_auto_post', 'requested_poster', 'bundle'];
      const bzModsList = bzModules.map(mod => {
        const curMod = curBz.filter(t => t.module === mod && t.direction === 'IN');
        const prevMod = prevBz.filter(t => t.module === mod && t.direction === 'IN');

        const curIn = curMod.reduce((sum, t) => sum + Number(t.amount), 0);
        const prevIn = prevMod.reduce((sum, t) => sum + Number(t.amount), 0);

        const curCount = curMod.length;
        const avgVal = curCount > 0 ? curIn / curCount : 0;
        
        // Revenue total for BingwaZone (excluding wallet payouts)
        const totalBzRev = curBz.filter(t => t.direction === 'IN').reduce((sum, t) => sum + Number(t.amount), 0);
        const percentage = totalBzRev > 0 ? (curIn / totalBzRev) * 100 : 0;
        const change = prevIn > 0 ? ((curIn - prevIn) / prevIn) * 100 : 0;

        return {
          id: mod,
          name: getReadableLabel(mod),
          revenue: curIn,
          count: curCount,
          average: avgVal,
          percentage,
          delta: change
        };
      }).sort((a, b) => b.revenue - a.revenue);

      setBzModuleStats(bzModsList);

      // BingwaZone Outgoing withdrawals (wallet)
      const bzWds = curBz.filter(t => t.module === 'wallet' && t.direction === 'OUT');
      setBzWithdrawals({
        amount: bzWds.reduce((sum, t) => sum + Number(t.amount), 0),
        count: bzWds.length
      });

      // 5. Pesatrix Activation vs Payouts
      const curPt = curMetrics.txList.filter(t => t.source_system === 'pesatrix');
      
      const ptActivations = curPt.filter(t => t.module === 'account_activation' && t.direction === 'IN');
      const ptWithdrawals = curPt.filter(t => t.module === 'wallet' && t.direction === 'OUT');

      const ptActRev = ptActivations.reduce((sum, t) => sum + Number(t.amount), 0);
      const ptActCnt = ptActivations.length;
      const ptWdVol = ptWithdrawals.reduce((sum, t) => sum + Number(t.amount), 0);
      const ptWdCnt = ptWithdrawals.length;

      setPesatrixStats({
        activationRevenue: ptActRev,
        activationCount: ptActCnt,
        avgActivationAmount: ptActCnt > 0 ? ptActRev / ptActCnt : 0,
        walletWithdrawals: ptWdVol,
        withdrawalCount: ptWdCnt,
        netFlow: ptActRev - ptWdVol,
        withdrawalRatio: ptActRev > 0 ? (ptWdVol / ptActRev) * 100 : 0
      });

      // 6. Top BingwaZone Agents (By Inbound payment totals)
      const agentMap: Record<string, { name: string; username: string; business: string; volume: number; count: number }> = {};
      curBz.filter(t => t.direction === 'IN' && t.agent_name).forEach(t => {
        const key = t.external_agent_id || t.agent_username || t.agent_name;
        if (!agentMap[key]) {
          agentMap[key] = {
            name: t.agent_name,
            username: t.agent_username || '',
            business: t.agent_business_name || '',
            volume: 0,
            count: 0
          };
        }
        agentMap[key].volume += Number(t.amount);
        agentMap[key].count += 1;
      });

      const topAgentsList = Object.values(agentMap)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);
      setTopAgents(topAgentsList);

      // 7. Time series grouping (respecting selected filters)
      let chartFilteredTxs = curMetrics.txList;
      if (selectedSource) {
        chartFilteredTxs = chartFilteredTxs.filter(t => t.source_system === selectedSource);
      }
      if (selectedModule) {
        chartFilteredTxs = chartFilteredTxs.filter(t => t.module === selectedModule);
      }

      const dailyMap: Record<string, { date: string; inflow: number; outflow: number; net: number }> = {};
      if (dateRange === 'today') {
        for (let h = 0; h < 24; h += 2) {
          const label = `${String(h).padStart(2, '0')}:00`;
          dailyMap[label] = { date: label, inflow: 0, outflow: 0, net: 0 };
        }
        chartFilteredTxs.forEach(t => {
          const hour = new Date(t.occurred_at || t.created_at).getHours();
          const bucketHour = Math.floor(hour / 2) * 2;
          const label = `${String(bucketHour).padStart(2, '0')}:00`;
          if (dailyMap[label]) {
            const amt = Number(t.amount);
            if (t.direction === 'IN') dailyMap[label].inflow += amt;
            else dailyMap[label].outflow += amt;
          }
        });
      } else {
        const daysToSeed = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / (24 * 3600 * 1000)));
        for (let i = daysToSeed - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          const dateStr = d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
          dailyMap[dateStr] = { date: dateStr, inflow: 0, outflow: 0, net: 0 };
        }
        chartFilteredTxs.forEach(t => {
          const dateStr = new Date(t.occurred_at || t.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
          if (dailyMap[dateStr]) {
            const amt = Number(t.amount);
            if (t.direction === 'IN') dailyMap[dateStr].inflow += amt;
            else dailyMap[dateStr].outflow += amt;
          }
        });
      }

      // Compute nets on time series
      const timeSeriesData = Object.values(dailyMap).map(d => ({
        ...d,
        net: d.inflow - d.outflow
      }));

      // Pie chart 1: Revenue by source system
      const sourceRevenue = Object.entries(sourcesData).map(([key, value]: any) => ({
        name: getReadableLabel(key),
        value: value.incoming
      })).filter(v => v.value > 0);

      // Pie chart 2: BingwaZone module splits
      const bzModulesChart = bzModsList.map(m => ({
        name: m.name,
        value: m.revenue
      })).filter(v => v.value > 0);

      // Bar Chart: Transactions by Payment Type
      const payTypeMap: Record<string, number> = {};
      chartFilteredTxs.forEach(t => {
        if (t.payment_type) {
          payTypeMap[t.payment_type] = (payTypeMap[t.payment_type] || 0) + Number(t.amount);
        }
      });
      const paymentTypes = Object.entries(payTypeMap).map(([name, value]) => ({
        name: getReadableLabel(name),
        volume: value
      })).sort((a, b) => b.volume - a.volume);

      // Bar Chart: Transactions by Service Source
      const svcMap: Record<string, number> = {};
      chartFilteredTxs.forEach(t => {
        if (t.service_source) {
          svcMap[t.service_source] = (svcMap[t.service_source] || 0) + Number(t.amount);
        }
      });
      const serviceSources = Object.entries(svcMap).map(([name, value]) => ({
        name: getReadableLabel(name),
        volume: value
      })).sort((a, b) => b.volume - a.volume).slice(0, 8);

      // Reconciliation Status Distribution
      const reconMap: Record<string, number> = { matched: 0, app_only: 0, provider_only: 0, conflict: 0 };
      // Note: we fetch reconciliation status directly in current period transactions
      currentPeriodTxs.forEach((t: any) => {
        const rs = t.reconciliation_status || 'not_applicable';
        if (reconMap[rs] !== undefined) {
          reconMap[rs]++;
        }
      });
      const reconDistribution = Object.entries(reconMap).map(([name, value]) => ({
        name: name.toUpperCase().replace('_', ' '),
        value
      })).filter(v => v.value > 0);

      setCharts({
        timeSeries: timeSeriesData,
        sourceRevenue: sourceRevenue.length > 0 ? sourceRevenue : [{ name: 'No Data', value: 0.1 }],
        bzModules: bzModulesChart.length > 0 ? bzModulesChart : [{ name: 'No Data', value: 0.1 }],
        paymentTypes,
        serviceSources,
        reconDistribution: reconDistribution.length > 0 ? reconDistribution : [{ name: 'N/A', value: 0.1 }]
      });

    } catch (err) {
      console.error('Failed computing analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, selectedSource, selectedModule, selectedStatus]);

  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);
  };

  const renderDelta = (delta: number) => {
    if (delta === 0) return <span className="text-[10px] text-muted-main">0% vs prev</span>;
    const isPositive = delta > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold rounded px-1.5 py-0.5 ${
        isPositive ? 'text-success-main bg-success-main/10' : 'text-danger bg-danger/10'
      }`}>
        {isPositive ? '+' : ''}{delta.toFixed(1)}% vs prev
      </span>
    );
  };

  return (
    <div className="space-y-6 font-outfit antialiased">
      
      {/* Filters Toolbar */}
      <div className="bg-panel border border-border-main rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        {/* Date Tabs Toggle */}
        <div className="flex bg-background border border-border-main p-1 rounded-lg self-start">
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: '7 Days' },
            { id: '30days', label: '30 Days' },
            { id: 'custom', label: 'Custom' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id as any)}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                dateRange === tab.id
                  ? 'bg-panel text-accent border border-border-main shadow-sm'
                  : 'text-muted-main hover:text-text-main'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Range & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5 bg-background border border-border-main rounded-lg px-2.5 py-1">
              <Calendar size={14} className="text-muted-main" />
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-transparent border-none text-xs text-text-main focus:outline-none py-1"
              />
              <span className="text-xs text-muted-main font-semibold">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-transparent border-none text-xs text-text-main focus:outline-none py-1"
              />
              <button 
                onClick={loadAnalytics}
                className="p-1 border border-border-main hover:bg-panel rounded text-muted-main cursor-pointer"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          )}

          {/* Source Filter */}
          <div className="flex items-center gap-2 bg-background border border-border-main rounded-lg px-2.5 py-1.5">
            <Filter size={14} className="text-muted-main" />
            <select
              value={selectedSource}
              onChange={e => {
                setSelectedSource(e.target.value);
                setSelectedModule(''); // reset module filter
              }}
              className="bg-transparent border-none text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
            >
              <option value="">All Source Systems</option>
              <option value="bingwazone">BingwaZone</option>
              <option value="pesatrix">Pesatrix</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {/* Module Filter (Contextual to Source) */}
          {selectedSource === 'bingwazone' && (
            <div className="flex items-center gap-2 bg-background border border-border-main rounded-lg px-2.5 py-1.5">
              <Filter size={14} className="text-muted-main" />
              <select
                value={selectedModule}
                onChange={e => setSelectedModule(e.target.value)}
                className="bg-transparent border-none text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
              >
                <option value="">All Modules</option>
                <option value="mini_site">Mini Sites</option>
                <option value="whatsapp_bot">WhatsApp Bot</option>
                <option value="whatsapp_agents">WhatsApp Agents</option>
                <option value="whatsapp_auto_post">WhatsApp Auto Post</option>
                <option value="requested_poster">Requested Posters</option>
                <option value="bundle">Bundles</option>
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-background border border-border-main rounded-lg px-2.5 py-1.5">
            <Filter size={14} className="text-muted-main" />
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-transparent border-none text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
            >
              <option value="SUCCESS">Successful Only</option>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="FAILED">Failed Only</option>
            </select>
          </div>
        </div>

      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-panel border border-border-main rounded-xl p-5 h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
            <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
          </div>
        </div>
      ) : (
        <>
          {/* 1. Global KPI Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Incoming Volume',
                value: formatKES(globalKpis.incomingVolume),
                delta: globalKpis.incomingVolumeDelta,
                color: 'text-success-main'
              },
              {
                label: 'Total Outgoing Volume',
                value: formatKES(globalKpis.outgoingVolume),
                delta: globalKpis.outgoingVolumeDelta,
                color: 'text-danger'
              },
              {
                label: 'Net Flow (Cashflow)',
                value: formatKES(globalKpis.netFlow),
                delta: globalKpis.netFlowDelta,
                color: globalKpis.netFlow >= 0 ? 'text-success-main' : 'text-danger'
              },
              {
                label: 'Total Transactions count',
                value: globalKpis.txCount.toLocaleString(),
                delta: globalKpis.txCountDelta,
                color: 'text-text-main'
              }
            ].map((k, i) => (
              <div key={i} className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between h-28">
                <span className="text-[10px] font-semibold text-muted-main uppercase tracking-wider block">
                  {k.label}
                </span>
                <div className="flex items-baseline justify-between mt-2 flex-wrap gap-2">
                  <h3 className={`text-xl md:text-2xl font-bold tracking-tight font-mono ${k.color}`}>
                    {k.value}
                  </h3>
                  {renderDelta(k.delta)}
                </div>
              </div>
            ))}
          </div>

          {/* 2. Visual Charts Row (Timeseries & Source Revenue share) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Time series area chart */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between lg:col-span-2">
              <div className="mb-4">
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <TrendingUp size={16} className="text-accent" />
                  Inflow vs Outflow Cash Trend
                </h3>
                <p className="text-xs text-muted-main">Comparison of incoming payments vs outgoing payouts</p>
              </div>
              <div className="h-64 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0DB02B" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0DB02B" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#FF3B30" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                    <XAxis dataKey="date" stroke="var(--muted-main)" />
                    <YAxis stroke="var(--muted-main)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Area type="monotone" dataKey="inflow" stroke="#0DB02B" fillOpacity={1} fill="url(#colorIn)" name="Inflow (IN)" strokeWidth={2} />
                    <Area type="monotone" dataKey="outflow" stroke="#FF3B30" fillOpacity={1} fill="url(#colorOut)" name="Outflow (OUT)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue split pie chart */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="mb-2">
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <PieIcon size={16} className="text-success-main" />
                  Revenue by Source System
                </h3>
                <p className="text-xs text-muted-main">Dissecting revenue shares from C2B/STK</p>
              </div>
              <div className="h-56 w-full flex items-center justify-center text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.sourceRevenue}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {charts.sourceRevenue.map((entry: any, index: number) => (
                        <Cell key={`cell-src-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[9px] text-muted-main font-semibold border-t border-border-main pt-3 text-center">
                {charts.sourceRevenue.map((entry: any, index: number) => (
                  <div key={entry.name} className="flex items-center gap-1 justify-center truncate">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="truncate">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Source System Summary Cards */}
          <div className="space-y-3 pt-4">
            <h3 className="font-bold text-base flex items-center gap-1.5 text-text-main">
              <Layers size={18} className="text-accent" />
              Source Systems Performance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(sourceStats).map(([key, data]: [string, any]) => {
                const label = getReadableLabel(key);
                return (
                  <div key={key} className="bg-panel border border-border-main rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-text-main">{label} Summary</h4>
                      <span className="text-[10px] text-muted-main font-semibold">{data.count} txs</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-main">Incoming Inflow:</span>
                        <span className="text-success-main font-mono">{formatKES(data.incoming)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-main">Outgoing Outflow:</span>
                        <span className="text-danger font-mono">{formatKES(data.outgoing)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold border-t border-border-main/55 pt-1">
                        <span className="text-text-main">Net Cash Flow:</span>
                        <span className={`font-mono ${data.net >= 0 ? 'text-success-main' : 'text-danger'}`}>{formatKES(data.net)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-muted-main border-t border-border-main/40 pt-2 flex-wrap gap-1">
                      <span>Share of Incoming: <strong>{data.percentage.toFixed(1)}%</strong></span>
                      {renderDelta(data.delta)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. BingwaZone Dissection Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            
            {/* BingwaZone Modules (Column span 2) */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm space-y-4 lg:col-span-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                    <Sparkles size={16} className="text-accent" />
                    BingwaZone Modules Inbound Revenue
                  </h3>
                  <p className="text-[11px] text-muted-main">Revenue split across micro-systems. Withdrawals excluded.</p>
                </div>
                <div className="text-right text-[10px] font-semibold text-muted-main bg-background/50 border border-border-main rounded-lg py-1 px-2">
                  Withdrawals: <strong className="text-danger font-mono">{formatKES(bzWithdrawals.amount)}</strong> ({bzWithdrawals.count} txs)
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bzModuleStats.map(mod => (
                  <div key={mod.id} className="bg-background/40 border border-border-main/60 rounded-xl p-4 flex flex-col justify-between h-28 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-text-main">{mod.name}</span>
                      <span className="text-[10px] text-muted-main font-mono">{mod.count} sales</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-2 flex-wrap gap-1">
                      <h4 className="text-base font-bold font-mono text-accent">{formatKES(mod.revenue)}</h4>
                      <span className="text-[9px] text-muted-main">Avg: <strong className="font-mono text-text-main">{formatKES(mod.average)}</strong></span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-muted-main border-t border-border-main/30 pt-1.5 flex-wrap gap-1">
                      <span>Share of BingwaZone: <strong>{mod.percentage.toFixed(1)}%</strong></span>
                      {renderDelta(mod.delta)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Agents Panel */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <Award size={16} className="text-warning-main" />
                  Top BingwaZone Agents
                </h3>
                <p className="text-xs text-muted-main">Highest billing agent operators by incoming totals</p>
              </div>
              {topAgents.length === 0 ? (
                <p className="text-xs text-muted-main italic text-center py-12">No agent transactions recorded in range.</p>
              ) : (
                <div className="space-y-2.5">
                  {topAgents.map((ag, idx) => (
                    <div key={ag.name + idx} className="bg-background/40 border border-border-main/50 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-text-main">{ag.name}</span>
                        {ag.business && <span className="text-[10px] text-muted-main block font-semibold">{ag.business}</span>}
                        {ag.username && <span className="text-[9px] text-muted-main font-mono">@{ag.username}</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-accent font-mono block">{formatKES(ag.volume)}</span>
                        <span className="text-[9px] text-muted-main font-mono">{ag.count} txs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* 5. Pesatrix Performance Panel */}
          <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm space-y-4 pt-4">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                <Layers size={16} className="text-success-main" />
                Pesatrix Activations & Payout Flows
              </h3>
              <p className="text-xs text-muted-main">Reconciliation of subscription activation inflow vs payout withdrawals</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Activation Revenue', value: formatKES(pesatrixStats.activationRevenue), desc: `${pesatrixStats.activationCount} Activations` },
                { label: 'Avg Activation Fee', value: formatKES(pesatrixStats.avgActivationAmount), desc: 'Cost per user activation' },
                { label: 'Wallet Withdrawals', value: formatKES(pesatrixStats.walletWithdrawals), desc: `${pesatrixStats.withdrawalCount} Withdrawals` },
                { label: 'Net Pesatrix Flow', value: formatKES(pesatrixStats.netFlow), desc: 'Activation inflow minus B2C' },
                { label: 'Withdrawal-to-Activation Ratio', value: `${pesatrixStats.withdrawalRatio.toFixed(1)}%`, desc: 'Ratio of payouts to revenue' }
              ].map((k, i) => (
                <div key={i} className="bg-background/30 border border-border-main rounded-xl p-4 flex flex-col justify-between h-24 shadow-2xs">
                  <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">{k.label}</span>
                  <div className="mt-1">
                    <h4 className="text-base font-bold font-mono text-text-main">{k.value}</h4>
                    <span className="text-[9px] text-muted-main font-semibold block mt-0.5">{k.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. In-depth Visualizations (Payment Type & Service Source & Reconciliation Status) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            {/* Payment Type Distribution */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <BarChart3 size={16} className="text-accent" />
                  Revenue by Payment Type
                </h3>
                <p className="text-xs text-muted-main">Aggregated volumes split by payment type category</p>
              </div>
              <div className="h-60 w-full text-xs">
                {charts.paymentTypes.length === 0 ? (
                  <p className="text-xs text-muted-main italic text-center py-20">No matching data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.paymentTypes} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-main)" />
                      <XAxis type="number" stroke="var(--muted-main)" />
                      <YAxis dataKey="name" type="category" stroke="var(--muted-main)" width={80} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                      <Bar dataKey="volume" fill="#00BFFF" radius={[0, 3, 3, 0]} name="Volume" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Service Source Distribution */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <BarChart3 size={16} className="text-success-main" />
                  Revenue by Service Source
                </h3>
                <p className="text-xs text-muted-main">Top billing business service sources</p>
              </div>
              <div className="h-60 w-full text-xs">
                {charts.serviceSources.length === 0 ? (
                  <p className="text-xs text-muted-main italic text-center py-20">No matching data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.serviceSources} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-main)" />
                      <XAxis type="number" stroke="var(--muted-main)" />
                      <YAxis dataKey="name" type="category" stroke="var(--muted-main)" width={100} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                      <Bar dataKey="volume" fill="#0DB02B" radius={[0, 3, 3, 0]} name="Volume" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Reconciliation status distribution */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <PieIcon size={16} className="text-warning-main" />
                  Reconciliation Status Distribution
                </h3>
                <p className="text-xs text-muted-main">Audit distribution in the current calendar range</p>
              </div>
              <div className="h-44 w-full flex items-center justify-center text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.reconDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {charts.reconDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-recon-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[8.5px] text-muted-main font-semibold border-t border-border-main pt-2">
                {charts.reconDistribution.map((entry: any, index: number) => (
                  <div key={entry.name} className="flex items-center gap-1 justify-center truncate">
                    <div className="w-2 h-2 rounded shrink-0" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }} />
                    <span className="truncate">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 7. Unattributed / Conflicts warnings */}
          {globalKpis.reconciliationConflicts > 0 && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-semibold flex items-center gap-2.5">
              <ShieldAlert size={18} className="shrink-0 animate-pulse" />
              <div>
                <strong>Reconciliation Conflicts Detected!</strong>
                <p className="text-[10px] text-danger/80 leading-relaxed mt-0.5">There are {globalKpis.reconciliationConflicts} transaction records with overlapping application identifiers or conflicting metadata. Open the Transactions log to inspect and resolve matching anomalies.</p>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
