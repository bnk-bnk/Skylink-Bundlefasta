'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  RefreshCw,
  Wallet,
  Mail
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
import { getDashboardStatsAction, getAnalyticsAction, getSmsStatsAction } from '@/app/actions';

const COLORS = ['#00BFFF', '#0DB02B', '#FF4500', '#FF3B30', '#6B7280'];

export default function DashboardView() {
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [smsStats, setSmsStats] = useState<{ sentToday: number; failedToday: number } | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          {[...Array(7)].map((_, i) => (
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
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);
  };

  const cards = [
    {
      title: 'Current Balance',
      value: formatKES(stats?.balance || 0),
      desc: stats?.lastRefresh ? `Refreshed ${new Date(stats.lastRefresh).toLocaleTimeString()}` : 'No snapshots',
      icon: Wallet,
      color: 'text-accent bg-accent/10',
    },
    {
      title: 'Incoming Today',
      value: formatKES(stats?.incomingToday || 0),
      desc: 'Successful C2B/STK',
      icon: ArrowUpRight,
      color: 'text-success-main bg-success-main/10',
    },
    {
      title: 'Outgoing Today',
      value: formatKES(stats?.outgoingToday || 0),
      desc: 'Successful B2C',
      icon: ArrowDownLeft,
      color: 'text-danger bg-danger/10',
    },
    {
      title: 'Net Flow',
      value: formatKES(stats?.netFlow || 0),
      desc: 'Today net activity',
      icon: Activity,
      color: (stats?.netFlow || 0) >= 0 ? 'text-success-main bg-success-main/10' : 'text-danger bg-danger/10',
    },
    {
      title: 'STKs Today',
      value: stats?.stksToday || 0,
      desc: 'Initiated push jobs',
      icon: TrendingUp,
      color: 'text-warning-main bg-warning-main/10',
    },
    {
      title: 'Reversals Today',
      value: stats?.reversalsToday || 0,
      desc: 'Reversal requests',
      icon: Scale,
      color: 'text-muted-main bg-muted-main/10',
    },
    {
      title: 'SMS Alerts',
      value: `Sent: ${smsStats?.sentToday || 0}`,
      desc: `Failed: ${smsStats?.failedToday || 0}`,
      icon: Mail,
      color: 'text-warning-main bg-warning-main/10',
    },
  ];

  const chartsData = analytics?.charts || {
    revenueTrend: [],
    cashflowTrend: [],
    revenueBySource: [],
    balanceTrend: [],
  };

  return (
    <div className="space-y-6">
      
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-panel border border-border-main rounded-xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-main truncate">{card.title}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${card.color}`}>
                  <Icon size={14} />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-sm md:text-base font-bold tracking-tight text-text-main truncate">
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
        
        {/* 1. Revenue Inflow Trend */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm">Revenue Inflow Trend</h3>
            <p className="text-xs text-muted-main">Inbound payments (C2B & STK) over the last 7 days</p>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00BFFF" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00BFFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                <XAxis dataKey="date" stroke="var(--muted-main)" />
                <YAxis stroke="var(--muted-main)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#00BFFF" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Cashflow In vs Out */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm">Cashflow Comparison</h3>
            <p className="text-xs text-muted-main">Daily inflow vs outflow volume (KES)</p>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.cashflowTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                <XAxis dataKey="date" stroke="var(--muted-main)" />
                <YAxis stroke="var(--muted-main)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                <Legend />
                <Bar dataKey="inflow" fill="#0DB02B" radius={[4, 4, 0, 0]} name="Inflow" />
                <Bar dataKey="outflow" fill="#E60000" radius={[4, 4, 0, 0]} name="Outflow" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Revenue by Source */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm">Revenue share by Source</h3>
            <p className="text-xs text-muted-main">Breakdown of product streams (Pesatrix, BingwaZone, etc.)</p>
          </div>
          <div className="h-64 w-full flex items-center justify-center text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartsData.revenueBySource}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {chartsData.revenueBySource.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
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
                <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                <Line type="monotone" dataKey="balance" stroke="#FF4500" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Balance" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
