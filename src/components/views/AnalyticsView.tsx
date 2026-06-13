'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  PieChart as PieIcon,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  CreditCard,
  Layers,
  Award,
  ShieldAlert,
  Sparkles,
  BarChart3
} from 'lucide-react';
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
  Cell
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
  const [selectedStatus, setSelectedStatus] = useState<string>('SUCCESS');
  const [selectedDirection, setSelectedDirection] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedReconciliationStatus, setSelectedReconciliationStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [availableModules, setAvailableModules] = useState<string[]>([]);

  const [globalKpis, setGlobalKpis] = useState({
    totalVolume: 0,
    totalVolumeDelta: 0,
    incomingVolume: 0,
    incomingVolumeDelta: 0,
    outgoingVolume: 0,
    outgoingVolumeDelta: 0,
    netFlow: 0,
    netFlowDelta: 0,
    txCount: 0,
    txCountDelta: 0,
    reconciliationConflicts: 0
  });

  const [pesatrixStats, setPesatrixStats] = useState({
    activationRevenue: 0,
    activationCount: 0,
    avgActivationAmount: 0,
    walletWithdrawals: 0,
    withdrawalCount: 0,
    netFlow: 0,
    withdrawalRatio: 0
  });

  const [moduleStats, setModuleStats] = useState<any[]>([]);
  const [sourceStats, setSourceStats] = useState<Record<string, any>>({});
  const [charts, setCharts] = useState<any>({
    timeSeries: [],
    sourceRevenue: [],
    moduleShare: [],
    paymentTypes: [],
    reconciliationDist: []
  });

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let currentStart: Date;
      let currentEnd: Date = now;
      let prevStart: Date;
      let prevEnd: Date;

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

      const rawTxs = await getAnalyticsTransactionsAction({
        dateStart: prevStart.toISOString(),
        dateEnd: currentEnd.toISOString()
      });

      // Extract unique modules dynamically from all fetched transactions
      const uniqueModules = Array.from(new Set(rawTxs.map((t: any) => t.module).filter(Boolean))) as string[];
      setAvailableModules(uniqueModules);

      const applyFilters = (txs: any[]) => {
        let filtered = txs;
        if (selectedStatus) filtered = filtered.filter(t => t.status === selectedStatus);
        if (selectedSource) filtered = filtered.filter(t => t.source_system === selectedSource);
        if (selectedModule) filtered = filtered.filter(t => t.module === selectedModule);
        if (selectedDirection) filtered = filtered.filter(t => t.direction === selectedDirection);
        if (selectedType) filtered = filtered.filter(t => t.transaction_type === selectedType);
        if (selectedReconciliationStatus) filtered = filtered.filter(t => t.reconciliation_status === selectedReconciliationStatus);
        if (searchQuery) {
          const q = searchQuery.toLowerCase().trim();
          filtered = filtered.filter(t => 
            (t.receipt && t.receipt.toLowerCase().includes(q)) ||
            (t.mpesa_receipt && t.mpesa_receipt.toLowerCase().includes(q)) ||
            (t.phone_number && t.phone_number.toLowerCase().includes(q)) ||
            (t.account_reference && t.account_reference.toLowerCase().includes(q))
          );
        }
        return filtered;
      };

      const computePeriodStats = (txs: any[]) => {
        const filtered = applyFilters(txs);
        const financialFiltered = filtered.filter(t => t.reconciliation_status !== 'conflict');
        let incomingVolume = 0, outgoingVolume = 0;
        financialFiltered.forEach(t => {
          const amt = Number(t.amount);
          if (t.direction === 'IN') incomingVolume += amt;
          else outgoingVolume += amt;
        });
        return {
          totalVolume: incomingVolume + outgoingVolume,
          incomingVolume,
          outgoingVolume,
          netFlow: incomingVolume - outgoingVolume,
          txCount: filtered.length,
          txList: filtered,
          financialList: financialFiltered
        };
      };

      const currentPeriodRaw = rawTxs.filter((t: any) => {
        const time = new Date(t.occurred_at || t.created_at).getTime();
        return time >= currentStart.getTime() && time <= currentEnd.getTime();
      });
      const prevPeriodRaw = rawTxs.filter((t: any) => {
        const time = new Date(t.occurred_at || t.created_at).getTime();
        return time >= prevStart.getTime() && time < currentStart.getTime();
      });

      const curMetrics = computePeriodStats(currentPeriodRaw);
      const prevMetrics = computePeriodStats(prevPeriodRaw);

      setGlobalKpis({
        totalVolume: curMetrics.totalVolume,
        totalVolumeDelta: prevMetrics.totalVolume > 0 ? ((curMetrics.totalVolume - prevMetrics.totalVolume) / prevMetrics.totalVolume) * 100 : 0,
        incomingVolume: curMetrics.incomingVolume,
        incomingVolumeDelta: prevMetrics.incomingVolume > 0 ? ((curMetrics.incomingVolume - prevMetrics.incomingVolume) / prevMetrics.incomingVolume) * 100 : 0,
        outgoingVolume: curMetrics.outgoingVolume,
        outgoingVolumeDelta: prevMetrics.outgoingVolume > 0 ? ((curMetrics.outgoingVolume - prevMetrics.outgoingVolume) / prevMetrics.outgoingVolume) * 100 : 0,
        netFlow: curMetrics.netFlow,
        netFlowDelta: prevMetrics.netFlow > 0 ? ((curMetrics.netFlow - prevMetrics.netFlow) / prevMetrics.netFlow) * 100 : 0,
        txCount: curMetrics.txCount,
        txCountDelta: prevMetrics.txCount > 0 ? ((curMetrics.txCount - prevMetrics.txCount) / prevMetrics.txCount) * 100 : 0,
        reconciliationConflicts: currentPeriodRaw.filter((t: any) => t.reconciliation_status === 'conflict').length
      });

      // Compute Pesatrix stats
      const curPt = curMetrics.financialList.filter((t: any) => t.source_system === 'pesatrix');
      const ptActivations = curPt.filter((t: any) => t.direction === 'IN' && (t.module === 'account_activation' || t.module === 'activation' || t.transaction_type === 'activation'));
      const ptWithdrawals = curPt.filter((t: any) => t.direction === 'OUT' && (t.module === 'wallet' || t.module === 'withdrawal' || t.transaction_type === 'withdrawal'));
      const ptActRev = ptActivations.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const ptActCnt = ptActivations.length;
      const ptWdVol = ptWithdrawals.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
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

      const sourcesList = ['bingwazone', 'pesatrix', 'manual', 'unknown'];
      const sourcesData: Record<string, any> = {};
      sourcesList.forEach(src => {
        const curSrc = curMetrics.financialList.filter((t: any) => t.source_system === src);
        const prevSrc = prevMetrics.financialList.filter((t: any) => t.source_system === src);
        const curIn = curSrc.filter((t: any) => t.direction === 'IN').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        const curOut = curSrc.filter((t: any) => t.direction === 'OUT').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        const prevIn = prevSrc.filter((t: any) => t.direction === 'IN').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        sourcesData[src] = {
          incoming: curIn,
          outgoing: curOut,
          net: curIn - curOut,
          count: curSrc.length,
          percentage: curMetrics.incomingVolume > 0 ? (curIn / curMetrics.incomingVolume) * 100 : 0,
          delta: prevIn > 0 ? ((curIn - prevIn) / prevIn) * 100 : 0
        };
      });
      setSourceStats(sourcesData);

      const moduleMap: Record<string, any> = {};
      curMetrics.financialList.forEach((t: any) => {
        if (t.module) {
          const key = `${t.source_system}:${t.module}:${t.direction}`;
          if (!moduleMap[key]) moduleMap[key] = { name: `${getReadableLabel(t.source_system)} - ${getReadableLabel(t.module)}`, volume: 0, count: 0, direction: t.direction };
          moduleMap[key].volume += Number(t.amount);
          moduleMap[key].count += 1;
        }
      });
      setModuleStats(Object.values(moduleMap).sort((a, b) => b.volume - a.volume));

      const dailyMap: Record<string, any> = {};
      if (dateRange === 'today') {
        for (let h = 0; h < 24; h += 2) {
          const label = `${String(h).padStart(2, '0')}:00`;
          dailyMap[label] = { date: label, inflow: 0, outflow: 0, net: 0 };
        }
        curMetrics.financialList.forEach((t: any) => {
          const hour = new Date(t.occurred_at || t.created_at).getHours();
          const label = `${String(Math.floor(hour / 2) * 2).padStart(2, '0')}:00`;
          if (dailyMap[label]) {
            if (t.direction === 'IN') dailyMap[label].inflow += Number(t.amount);
            else dailyMap[label].outflow += Number(t.amount);
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
        curMetrics.financialList.forEach((t: any) => {
          const dateStr = new Date(t.occurred_at || t.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
          if (dailyMap[dateStr]) {
            if (t.direction === 'IN') dailyMap[dateStr].inflow += Number(t.amount);
            else dailyMap[dateStr].outflow += Number(t.amount);
          }
        });
      }

      const payTypeMap: Record<string, number> = {};
      curMetrics.financialList.forEach((t: any) => {
        if (t.payment_type) payTypeMap[t.payment_type] = (payTypeMap[t.payment_type] || 0) + Number(t.amount);
      });

      const reconMap: Record<string, number> = { matched: 0, app_only: 0, provider_only: 0, conflict: 0 };
      currentPeriodRaw.forEach((t: any) => {
        if (t.reconciliation_status && reconMap[t.reconciliation_status] !== undefined) reconMap[t.reconciliation_status]++;
      });

      // Calculate Module Share for Pie Chart (Inflows only)
      const moduleShareMap: Record<string, number> = {};
      curMetrics.financialList.forEach((t: any) => {
        if (t.module && t.direction === 'IN') {
          moduleShareMap[t.module] = (moduleShareMap[t.module] || 0) + Number(t.amount);
        }
      });
      const moduleShare = Object.entries(moduleShareMap).map(([name, value]) => ({
        name: getReadableLabel(name),
        value
      })).sort((a, b) => b.value - a.value);

      setCharts({
        timeSeries: Object.values(dailyMap).map(d => ({ ...d, net: d.inflow - d.outflow })),
        sourceRevenue: Object.entries(sourcesData).map(([k, v]: any) => ({ name: getReadableLabel(k), volume: v.incoming })).filter(v => v.volume > 0),
        moduleShare,
        paymentTypes: Object.entries(payTypeMap).map(([name, volume]) => ({ name: getReadableLabel(name), volume })),
        reconciliationDist: Object.entries(reconMap).map(([name, value]) => ({ name: name.toUpperCase().replace('_', ' '), value })).filter(v => v.value > 0)
      });
    } catch (err) { console.error('Error:', err); } finally { setLoading(false); }
  };

  useEffect(() => { loadAnalytics(); }, [dateRange, selectedSource, selectedModule, selectedStatus, selectedDirection, selectedType, selectedReconciliationStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); loadAnalytics(); };
  const formatKES = (val: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);
  const renderDelta = (delta: number) => (
    <span className={`text-[10px] font-bold ${delta >= 0 ? 'text-success-main' : 'text-danger'}`}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
    </span>
  );

  return (
    <div className="space-y-6 font-outfit antialiased">
      <div className="bg-panel border border-border-main rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="flex bg-background border border-border-main p-1 rounded-xl self-start shadow-sm">
            {[ { id: 'today', label: 'Today' }, { id: '7days', label: '7 Days' }, { id: '30days', label: '30 Days' }, { id: 'custom', label: 'Custom' } ].map(tab => (
              <button key={tab.id} onClick={() => setDateRange(tab.id as any)} className={`text-xs px-3.5 py-2 rounded-lg font-bold transition-all ${dateRange === tab.id ? 'bg-panel text-accent border border-border-main shadow-sm' : 'text-muted-main hover:text-text-main'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md flex gap-2">
            <div className="flex-1 bg-background border border-border-main rounded-xl px-3 py-2 flex items-center gap-2">
              <Search size={14} className="text-muted-main" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search phone, receipt, account reference..." className="bg-transparent border-none text-xs text-text-main focus:outline-none w-full font-medium" />
            </div>
            <button type="submit" className="bg-accent hover:opacity-90 text-white rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer">Search</button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'All Services', val: selectedSource, set: (v: string) => { setSelectedSource(v); setSelectedModule(''); }, opts: ['bingwazone', 'pesatrix', 'manual', 'unknown'] },
            { label: 'All Modules', val: selectedModule, set: setSelectedModule, opts: availableModules },
            { label: 'All Flow Directions', val: selectedDirection, set: setSelectedDirection, opts: ['IN', 'OUT'] },
            { label: 'All Tx Types', val: selectedType, set: setSelectedType, opts: ['C2B', 'STK', 'B2C', 'REVERSAL', 'activation', 'withdrawal'] },
            { label: 'Reconciliation', val: selectedReconciliationStatus, set: setSelectedReconciliationStatus, opts: ['matched', 'conflict', 'app_only', 'provider_only'] },
            { label: 'All Statuses', val: selectedStatus, set: setSelectedStatus, opts: ['SUCCESS', 'PENDING', 'FAILED'] }
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-background border border-border-main rounded-xl px-3 py-2">
              <Filter size={12} className="text-muted-main" />
              <select value={f.val} onChange={e => f.set(e.target.value)} className="bg-transparent border-none text-xs text-text-main focus:outline-none font-bold w-full cursor-pointer">
                <option value="">{f.label}</option>
                {f.opts.map(o => <option key={o} value={o}>{getReadableLabel(o)}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-panel border border-border-main rounded-xl p-5 h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-panel border border-border-main rounded-xl p-5 h-80 lg:col-span-2" />
            <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
          </div>
        </div>
      ) : (
        <>
          {/* 1. Global KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[ 
              { label: 'Total Volume', v: globalKpis.totalVolume, d: globalKpis.totalVolumeDelta, c: 'text-accent' }, 
              { label: 'Total Inflow', v: globalKpis.incomingVolume, d: globalKpis.incomingVolumeDelta, c: 'text-success-main' }, 
              { label: 'Total Outflow', v: globalKpis.outgoingVolume, d: globalKpis.outgoingVolumeDelta, c: 'text-danger' }, 
              { label: 'Net Flow', v: globalKpis.netFlow, d: globalKpis.netFlowDelta, c: globalKpis.netFlow >= 0 ? 'text-success-main' : 'text-danger' }, 
              { label: 'Recon Conflicts', v: globalKpis.reconciliationConflicts, d: 0, c: globalKpis.reconciliationConflicts > 0 ? 'text-danger animate-pulse' : 'text-muted-main' } 
            ].map((k, i) => (
              <div key={i} className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm h-28 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-muted-main uppercase tracking-wider block">{k.label}</span>
                <div className="flex items-baseline justify-between mt-2">
                  <h3 className={`text-lg font-bold font-mono tracking-tight ${k.c}`}>
                    {typeof k.v === 'number' ? (k.label.includes('Conflicts') ? k.v : formatKES(k.v)) : k.v}
                  </h3>
                  {k.d !== 0 && renderDelta(k.d)}
                </div>
              </div>
            ))}
          </div>

          {/* 2. Visual Charts Row (Timeseries Area + Inflow Module share Pie) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-panel border border-border-main rounded-2xl p-5 lg:col-span-2 shadow-sm flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-accent" />
                  Cash Trend Analysis
                </h3>
                <p className="text-xs text-muted-main">Inflow vs outflow daily processed values over the range</p>
              </div>
              <div className="h-64 text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0DB02B" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#0DB02B" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#FF3B30" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                    <XAxis dataKey="date" stroke="var(--muted-main)" />
                    <YAxis stroke="var(--muted-main)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }} formatter={(v) => [formatKES(v as number), '']} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Area type="monotone" dataKey="inflow" stroke="#0DB02B" fillOpacity={1} fill="url(#colorIn)" name="Inflow (IN)" strokeWidth={2} />
                    <Area type="monotone" dataKey="outflow" stroke="#FF3B30" fillOpacity={1} fill="url(#colorOut)" name="Outflow (OUT)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Module Share Pie Chart */}
            <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="mb-2">
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <PieIcon size={16} className="text-success-main" />
                  Inflow Share by Module
                </h3>
                <p className="text-xs text-muted-main">Attributed inflow revenue shares from business modules</p>
              </div>
              <div className="h-56 w-full flex items-center justify-center text-xs">
                {charts.moduleShare.length === 0 ? (
                  <span className="text-xs text-muted-main italic py-10">No matching module inflow data.</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.moduleShare}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                      >
                        {charts.moduleShare.map((entry: any, index: number) => (
                          <Cell key={`cell-mod-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }} formatter={(v) => [formatKES(v as number), 'Volume']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1 text-[9px] text-muted-main font-semibold border-t border-border-main pt-3 text-center">
                {charts.moduleShare.slice(0, 3).map((entry: any, index: number) => (
                  <div key={entry.name} className="flex items-center gap-1 justify-center truncate">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="truncate">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Pesatrix Activations & Payout Flows Panel */}
          <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm space-y-4">
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
                <div key={i} className="bg-background/35 border border-border-main/70 rounded-xl p-4 flex flex-col justify-between h-24 shadow-2xs">
                  <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">{k.label}</span>
                  <div className="mt-1">
                    <h4 className="text-base font-bold font-mono text-text-main">{k.value}</h4>
                    <span className="text-[9px] text-muted-main font-semibold block mt-0.5">{k.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. In-depth Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            {/* Payment Type Distribution */}
            <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm space-y-4">
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
                      <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }} formatter={(v) => [formatKES(v as number), '']} />
                      <Bar dataKey="volume" fill="#00BFFF" radius={[0, 3, 3, 0]} name="Volume" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Service Source Distribution */}
            <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <BarChart3 size={16} className="text-success-main" />
                  Revenue by Service Source
                </h3>
                <p className="text-xs text-muted-main">Top billing business service sources</p>
              </div>
              <div className="h-60 w-full text-xs">
                {charts.sourceRevenue.length === 0 ? (
                  <p className="text-xs text-muted-main italic text-center py-20">No matching data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.sourceRevenue} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-main)" />
                      <XAxis type="number" stroke="var(--muted-main)" />
                      <YAxis dataKey="name" type="category" stroke="var(--muted-main)" width={100} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }} formatter={(v) => [formatKES(v as number), '']} />
                      <Bar dataKey="volume" fill="#0DB02B" radius={[0, 3, 3, 0]} name="Volume" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Reconciliation status distribution */}
            <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-text-main">
                  <PieIcon size={16} className="text-warning-main" />
                  Reconciliation Distribution
                </h3>
                <p className="text-xs text-muted-main">Audit distribution in the current calendar range</p>
              </div>
              <div className="h-44 w-full flex items-center justify-center text-xs">
                {charts.reconciliationDist.length === 0 ? (
                  <p className="text-xs text-muted-main italic py-10">No audit records found.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.reconciliationDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {charts.reconciliationDist.map((entry: any, index: number) => (
                          <Cell key={`cell-recon-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[8.5px] text-muted-main font-semibold border-t border-border-main pt-2">
                {charts.reconciliationDist.map((entry: any, index: number) => (
                  <div key={entry.name} className="flex items-center gap-1 justify-center truncate">
                    <div className="w-2 h-2 rounded shrink-0" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }} />
                    <span className="truncate">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Unattributed / Conflicts warnings */}
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
