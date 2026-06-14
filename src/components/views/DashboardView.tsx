'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  RefreshCw,
  Wallet,
  Mail,
  Cpu,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { getDashboardStatsAction, getAnalyticsAction, getSmsStatsAction, refreshBalanceAction } from '@/app/actions';

const COLORS = ['#00BFFF', '#0DB02B', '#FF4500', '#FF3B30', '#6B7280', '#D000F0', '#FFCC00'];

export default function DashboardView() {
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [smsStats, setSmsStats] = useState<{ sentToday: number; failedToday: number; queued?: number; channel?: string; lastSuccessful?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingBalance, setRefreshingBalance] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await getDashboardStatsAction();
      const a = await getAnalyticsAction();
      const sms = await getSmsStatsAction();
      setStats(s);
      setAnalytics(a);
      setSmsStats(sms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefreshBalance = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card clicks if any
    setRefreshingBalance(true);
    try {
      const res = await refreshBalanceAction();
      if (res && res.success) {
        setStats((prev: any) => ({
          ...prev,
          balance: res.balance,
          lastRefresh: res.fetchedAt
        }));
      }
    } catch (err) {
      console.error('Failed to reload balance:', err);
    } finally {
      setRefreshingBalance(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-panel border border-border-main rounded-xl p-4 h-28" />
          ))}
        </div>
        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80" />
        </div>
      </div>
    );
  }

  // Format currency
  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);
  };

  const cards = [
    {
      title: 'Current Balance',
      value: formatKES(stats?.balance || 0),
      desc: stats?.lastRefresh ? `Refreshed ${new Date(stats.lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No snapshots',
      icon: Wallet,
      color: 'text-accent bg-accent/10',
      action: (
        <button
          onClick={handleRefreshBalance}
          disabled={refreshingBalance}
          title="Refresh Balance"
          className="p-1 hover:bg-background/80 border border-border-main/50 rounded transition-all cursor-pointer text-muted-main hover:text-text-main disabled:opacity-50"
        >
          <RefreshCw size={11} className={refreshingBalance ? 'animate-spin' : ''} />
        </button>
      )
    },
    {
      title: 'Incoming Today',
      value: formatKES(stats?.incomingToday || 0),
      desc: 'Successful Inflows',
      icon: ArrowUpRight,
      color: 'text-success-main bg-success-main/10',
    },
    {
      title: 'Outgoing Today',
      value: formatKES(stats?.outgoingToday || 0),
      desc: 'Successful Payouts',
      icon: ArrowDownLeft,
      color: 'text-danger bg-danger/10',
    },
    {
      title: 'Pesatrix Today',
      value: `In: ${formatKES(stats?.pesatrixInToday || 0)}`,
      desc: `Out: ${formatKES(stats?.pesatrixOutToday || 0)}`,
      icon: Layers,
      color: 'text-warning-main bg-warning-main/10',
    },
    {
      title: 'BingwaOne Today',
      value: `In: ${formatKES(stats?.bingwaoneInToday || 0)}`,
      desc: `Out: ${formatKES(stats?.bingwaoneOutToday || 0)}`,
      icon: Cpu,
      color: 'text-accent bg-accent/10',
    },
    {
      title: 'Alert Notifications',
      value: `${smsStats?.channel?.toUpperCase() || 'SMS'}: ${smsStats?.sentToday || 0} Sent`,
      desc: `Failed: ${smsStats?.failedToday || 0} | Q: ${smsStats?.queued || 0}${
        smsStats?.lastSuccessful
          ? ` | ${new Date(smsStats.lastSuccessful).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : ''
      }`,
      icon: Mail,
      color: 'text-muted-main bg-muted-main/10',
    },
  ];

  const chartsData = analytics?.charts || {
    revenueTrend: [],
    cashflowTrend: [],
    revenueBySource: [],
    moduleShare: [],
    balanceTrend: [],
  };

  return (
    <div className="space-y-6">
      
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-panel border border-border-main rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-border-main/80 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-main truncate">{card.title}</span>
                <div className="flex items-center gap-1.5">
                  {card.action}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${card.color}`}>
                    <Icon size={14} />
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-sm md:text-[15px] font-bold tracking-tight text-text-main truncate">
                  {card.value}
                </h3>
                <span className="text-[10px] text-muted-main block truncate mt-0.5">{card.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2x2 Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Service Revenue Inflow Trend */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm">Service Revenue Inflow Trend</h3>
            <p className="text-xs text-muted-main">Daily inflows comparison (BingwaOne vs Pesatrix) over last 7 days</p>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00BFFF" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00BFFF" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0DB02B" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0DB02B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                <XAxis dataKey="date" stroke="var(--muted-main)" />
                <YAxis stroke="var(--muted-main)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }}
                  formatter={(value) => [formatKES(value as number), '']}
                />
                <Legend />
                <Area type="monotone" dataKey="bingwaoneInflow" stroke="#00BFFF" strokeWidth={2} fillOpacity={1} fill="url(#colorBz)" name="BingwaOne In" />
                <Area type="monotone" dataKey="pesatrixInflow" stroke="#0DB02B" strokeWidth={2} fillOpacity={1} fill="url(#colorPt)" name="Pesatrix In" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Service Comparison (Daily Volume) */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm">Service Volumes Processed</h3>
            <p className="text-xs text-muted-main">Daily total transaction volumes (Inflow + Outflow)</p>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.cashflowTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                <XAxis dataKey="date" stroke="var(--muted-main)" />
                <YAxis stroke="var(--muted-main)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }}
                  formatter={(value) => [formatKES(value as number), '']}
                />
                <Legend />
                <Bar dataKey="bingwaoneVolume" fill="#00BFFF" radius={[4, 4, 0, 0]} name="BingwaOne" />
                <Bar dataKey="pesatrixVolume" fill="#0DB02B" radius={[4, 4, 0, 0]} name="Pesatrix" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Inflow Share by Module */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm">Inflow Share by Module</h3>
            <p className="text-xs text-muted-main">Inbound revenue share across active product modules</p>
          </div>
          <div className="h-64 w-full flex items-center justify-center text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartsData.moduleShare}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {chartsData.moduleShare.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }}
                  formatter={(value) => [formatKES(value as number), 'Volume']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Balance Snapshot Trend */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm">Historical Balance Trend</h3>
            <p className="text-xs text-muted-main">M-Pesa PayBill account balance snapshots</p>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartsData.balanceTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                <XAxis dataKey="date" stroke="var(--muted-main)" />
                <YAxis stroke="var(--muted-main)" domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }}
                  formatter={(value) => [formatKES(value as number), 'Balance']}
                />
                <Line type="monotone" dataKey="balance" stroke="#FF4500" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Balance" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

