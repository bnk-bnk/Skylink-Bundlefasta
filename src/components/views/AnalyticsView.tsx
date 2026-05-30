'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, BarChart3, PieChart as PieIcon, ArrowUpRight, ArrowDownLeft, Calendar, Filter, RefreshCw, Layers } from 'lucide-react';
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

const COLORS = ['#00BFFF', '#0DB02B', '#FF4500', '#FF3B30', '#6B7280'];

export default function AnalyticsView() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7days' | 'custom'>('7days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');

  // Computed Stats
  const [kpis, setKpis] = useState({
    volume: 0,
    volumeDelta: 0,
    count: 0,
    countDelta: 0,
    avgValue: 0,
    avgValueDelta: 0,
    successRate: 0,
    successRateDelta: 0
  });

  const [charts, setCharts] = useState<{
    volumeTrend: any[];
    channelDistribution: any[];
    transactionFlow: any[];
    peakHours: any[];
  }>({
    volumeTrend: [],
    channelDistribution: [],
    transactionFlow: [],
    peakHours: []
  });

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let currentStart: Date;
      let currentEnd: Date = now;
      let prevStart: Date;
      let prevEnd: Date;

      // 1. Resolve selected Date Ranges
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
      } else {
        currentStart = customStart ? new Date(customStart) : new Date();
        currentEnd = customEnd ? new Date(customEnd) : now;
        const duration = currentEnd.getTime() - currentStart.getTime();
        prevStart = new Date(currentStart.getTime() - duration);
        prevEnd = currentStart;
      }

      // 2. Fetch all raw transactions spanning both current and comparison intervals
      const rawTxs = await getAnalyticsTransactionsAction({
        dateStart: prevStart.toISOString(),
        dateEnd: currentEnd.toISOString()
      });

      // 3. Separate Current vs Previous dataset
      const currentPeriodTxs = rawTxs.filter((t: any) => {
        const time = new Date(t.created_at).getTime();
        return time >= currentStart.getTime() && time <= currentEnd.getTime();
      });

      const prevPeriodTxs = rawTxs.filter((t: any) => {
        const time = new Date(t.created_at).getTime();
        return time >= prevStart.getTime() && time < currentStart.getTime();
      });

      // 4. Apply Channel Filters (C2B, STK, B2C, REVERSAL)
      const filteredCurrentTxs = selectedChannel 
        ? currentPeriodTxs.filter((t: any) => t.transaction_type === selectedChannel)
        : currentPeriodTxs;

      const filteredPrevTxs = selectedChannel
        ? prevPeriodTxs.filter((t: any) => t.transaction_type === selectedChannel)
        : prevPeriodTxs;

      // Successful transactions subsets
      const currentSuccess = filteredCurrentTxs.filter((t: any) => t.status === 'SUCCESS');
      const prevSuccess = filteredPrevTxs.filter((t: any) => t.status === 'SUCCESS');

      // KPIs calculation
      const curVolume = currentSuccess.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const prevVolume = prevSuccess.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const volDelta = prevVolume > 0 ? ((curVolume - prevVolume) / prevVolume) * 100 : 0;

      const curCount = currentSuccess.length;
      const prevCount = prevSuccess.length;
      const countDelta = prevCount > 0 ? ((curCount - prevCount) / prevCount) * 100 : 0;

      const curAvg = curCount > 0 ? curVolume / curCount : 0;
      const prevAvg = prevCount > 0 ? prevVolume / prevCount : 0;
      const avgDelta = prevAvg > 0 ? ((curAvg - prevAvg) / prevAvg) * 100 : 0;

      const curRate = filteredCurrentTxs.length > 0
        ? Math.round((currentSuccess.length / filteredCurrentTxs.length) * 100)
        : 100;
      const prevRate = filteredPrevTxs.length > 0
        ? Math.round((prevSuccess.length / filteredPrevTxs.length) * 100)
        : 100;
      const rateDelta = curRate - prevRate; // Direct difference

      setKpis({
        volume: curVolume,
        volumeDelta: volDelta,
        count: curCount,
        countDelta: countDelta,
        avgValue: curAvg,
        avgValueDelta: avgDelta,
        successRate: curRate,
        successRateDelta: rateDelta
      });

      // 5. Chart 1: Volume Trend & Chart 3: Transaction Flow (Daily Trend mappings)
      const dailyMap: { [key: string]: { date: string; volume: number; inflow: number; outflow: number } } = {};
      
      // Seed keys depending on date range choice
      if (dateRange === 'today') {
        // Group by hours
        for (let h = 0; h < 24; h += 2) {
          const label = `${String(h).padStart(2, '0')}:00`;
          dailyMap[label] = { date: label, volume: 0, inflow: 0, outflow: 0 };
        }
        currentSuccess.forEach((t: any) => {
          const hour = new Date(t.created_at).getHours();
          const bucketHour = Math.floor(hour / 2) * 2;
          const label = `${String(bucketHour).padStart(2, '0')}:00`;
          if (dailyMap[label]) {
            dailyMap[label].volume += Number(t.amount);
            if (t.direction === 'IN') dailyMap[label].inflow += Number(t.amount);
            if (t.direction === 'OUT') dailyMap[label].outflow += Number(t.amount);
          }
        });
      } else {
        // Group by days
        const daysToSeed = dateRange === '7days' ? 7 : Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / (24 * 3600 * 1000)));
        for (let i = daysToSeed - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          const dateStr = d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
          dailyMap[dateStr] = { date: dateStr, volume: 0, inflow: 0, outflow: 0 };
        }

        currentSuccess.forEach((t: any) => {
          const dateStr = new Date(t.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
          if (dailyMap[dateStr]) {
            dailyMap[dateStr].volume += Number(t.amount);
            if (t.direction === 'IN') dailyMap[dateStr].inflow += Number(t.amount);
            if (t.direction === 'OUT') dailyMap[dateStr].outflow += Number(t.amount);
          }
        });
      }

      // Chart 2: Channel Distribution (dissect spread across C2B, STK, B2C, REVERSAL)
      const channelVolumeMap: { [key: string]: number } = { C2B: 0, STK: 0, B2C: 0, REVERSAL: 0 };
      currentSuccess.forEach((t: any) => {
        const type = t.transaction_type;
        if (channelVolumeMap[type] !== undefined) {
          channelVolumeMap[type] += Number(t.amount);
        }
      });
      const channelDistribution = Object.entries(channelVolumeMap).map(([name, value]) => ({
        name,
        value
      })).filter(item => item.value > 0);

      // Chart 4: Peak Hours (Hourly volumes)
      const hourlyCounts = Array.from({ length: 24 }, (_, h) => ({
        hour: `${String(h).padStart(2, '0')}:00`,
        count: 0,
        volume: 0
      }));
      currentSuccess.forEach((t: any) => {
        const hour = new Date(t.created_at).getHours();
        hourlyCounts[hour].count += 1;
        hourlyCounts[hour].volume += Number(t.amount);
      });

      setCharts({
        volumeTrend: Object.values(dailyMap),
        channelDistribution: channelDistribution.length > 0 ? channelDistribution : [{ name: 'No Activity', value: 0.1 }],
        transactionFlow: Object.values(dailyMap),
        peakHours: hourlyCounts
      });

    } catch (err) {
      console.error('Error loading analytics calculations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, selectedChannel]);

  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);
  };

  const renderDelta = (delta: number, isDirectRate: boolean = false) => {
    if (delta === 0) return <span className="text-[10px] text-brand-text/50 font-medium">0% vs prev</span>;
    const isPositive = delta > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold rounded px-1.5 py-0.5 ${
        isPositive ? 'text-success-main bg-success-main/10' : 'text-danger bg-danger/10'
      }`}>
        {isPositive ? '+' : ''}{delta.toFixed(1)}{isDirectRate ? '%' : '%'}
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
            { id: '7days', label: 'Last 7 Days' },
            { id: 'custom', label: 'Custom Range' }
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

        {/* Custom Range & Channel Selectors */}
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

          <div className="flex items-center gap-2 bg-background border border-border-main rounded-lg px-2.5 py-1.5">
            <Filter size={14} className="text-muted-main" />
            <select
              value={selectedChannel}
              onChange={e => setSelectedChannel(e.target.value)}
              className="bg-transparent border-none text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
            >
              <option value="">All Channels</option>
              <option value="C2B">C2B PayBill</option>
              <option value="STK">STK Push</option>
              <option value="B2C">B2C Payout</option>
              <option value="REVERSAL">Reversal</option>
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
            <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
            <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
          </div>
        </div>
      ) : (
        <>
          {/* KPI METRICS ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Volume',
                value: formatKES(kpis.volume),
                delta: kpis.volumeDelta,
                color: 'text-text-main'
              },
              {
                label: 'Total Transactions',
                value: kpis.count.toLocaleString(),
                delta: kpis.countDelta,
                color: 'text-text-main'
              },
              {
                label: 'Average Transaction',
                value: formatKES(kpis.avgValue),
                delta: kpis.avgValueDelta,
                color: 'text-text-main'
              },
              {
                label: 'Overall Success Rate',
                value: `${kpis.successRate}%`,
                delta: kpis.successRateDelta,
                color: 'text-text-main',
                isRate: true
              }
            ].map((k, i) => (
              <div key={i} className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between h-28">
                <span className="text-[10px] font-semibold text-muted-main uppercase tracking-wider block">
                  {k.label}
                </span>
                <div className="flex items-baseline justify-between mt-2 flex-wrap gap-2">
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight font-mono text-text-main">
                    {k.value}
                  </h3>
                  {renderDelta(k.delta, k.isRate)}
                </div>
              </div>
            ))}
          </div>

          {/* VISUAL CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Volume Trend (Area Chart) */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-accent" />
                  Volume Trend
                </h3>
                <p className="text-xs text-muted-main">Aggregated payment volumes over the active range</p>
              </div>
              <div className="h-64 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.volumeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00BFFF" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#00BFFF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                    <XAxis dataKey="date" stroke="var(--muted-main)" />
                    <YAxis stroke="var(--muted-main)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                    <Area type="monotone" dataKey="volume" stroke="#00BFFF" fillOpacity={1} fill="url(#colorVolume)" name="Volume" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Channel Distribution (Pie Chart) */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="mb-2">
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <PieIcon size={16} className="text-success-main" />
                  Channel Distribution
                </h3>
                <p className="text-xs text-muted-main">Volume spread dissecting transaction types</p>
              </div>
              <div className="h-56 w-full flex items-center justify-center text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.channelDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {charts.channelDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-main font-semibold border-t border-border-main pt-3">
                {charts.channelDistribution.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 truncate justify-center">
                    <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="truncate">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Transaction Flow (Bar Chart) */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <Layers size={16} className="text-warning-main" />
                  Transaction Inflow vs Outflow Flow
                </h3>
                <p className="text-xs text-muted-main">Daily comparison of IN (C2B, STK) vs OUT (B2C, Reversal)</p>
              </div>
              <div className="h-64 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.transactionFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                    <XAxis dataKey="date" stroke="var(--muted-main)" />
                    <YAxis stroke="var(--muted-main)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Bar dataKey="inflow" fill="#0DB02B" radius={[3, 3, 0, 0]} name="Inflow (IN)" />
                    <Bar dataKey="outflow" fill="#FF3B30" radius={[3, 3, 0, 0]} name="Outflow (OUT)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Peak Hours (Bar Chart) */}
            <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <BarChart3 size={16} className="text-accent" />
                  Peak Traffic Hours
                </h3>
                <p className="text-xs text-muted-main">Aggregated transaction volumes across the 24-hour cycle</p>
              </div>
              <div className="h-64 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                    <XAxis dataKey="hour" stroke="var(--muted-main)" />
                    <YAxis stroke="var(--muted-main)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                    <Bar dataKey="volume" fill="#00BFFF" radius={[2, 2, 0, 0]} name="Volume" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
