'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  ArrowUpRight,
  ArrowDownLeft,
  Cpu,
  Layers,
  Activity,
  RefreshCw,
  Search,
  Calendar,
  AlertCircle,
  TrendingUp,
  CreditCard,
  History,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { getServicesStatsAction } from '@/app/actions';
import { getReadableLabel } from '@/lib/utils/labels';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#00BFFF', '#0DB02B', '#FF4500', '#FF3B30', '#6B7280', '#D000F0', '#FFCC00'];

export default function ServicesView() {
  const [activeTab, setActiveTab] = useState<'bingwazone' | 'pesatrix'>('bingwazone');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async (isRef = false) => {
    if (isRef) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getServicesStatsAction();
      if (res.success) {
        setData(res);
      } else {
        setError(res.error || 'Failed to retrieve services statistics');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading services data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse font-outfit">
        <div className="h-10 bg-panel border border-border-main rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-panel border border-border-main rounded-2xl p-5 h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-panel border border-border-main rounded-2xl h-96" />
          <div className="bg-panel border border-border-main rounded-2xl h-96" />
        </div>
      </div>
    );
  }

  const serviceData = activeTab === 'bingwazone' ? data?.bingwazone : data?.pesatrix;
  const oppositeData = activeTab === 'bingwazone' ? data?.pesatrix : data?.bingwazone;
  const serviceLabel = activeTab === 'bingwazone' ? 'BingwaZone' : 'Pesatrix';

  // Prepare chart data for Modules Inflow Share
  const moduleChartData = (serviceData?.modules || []).map((m: any) => ({
    name: getReadableLabel(m.name),
    value: m.volume,
    count: m.count
  }));

  // Prepare chart data for Transaction Types Inflow vs Outflow
  const typeChartData = (serviceData?.types || []).map((t: any) => ({
    name: t.name.toUpperCase(),
    volume: t.volume,
    count: t.count
  }));

  return (
    <div className="space-y-6 font-outfit antialiased">
      {/* Top Controls & Navigation Tab Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex bg-background border border-border-main p-1 rounded-xl self-start shadow-sm">
          <button
            onClick={() => setActiveTab('bingwazone')}
            className={`text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'bingwazone'
                ? 'bg-panel text-accent border border-border-main shadow-sm'
                : 'text-muted-main hover:text-text-main'
            }`}
          >
            <Cpu size={14} />
            <span>BingwaZone Portal</span>
          </button>
          <button
            onClick={() => setActiveTab('pesatrix')}
            className={`text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'pesatrix'
                ? 'bg-panel text-accent border border-border-main shadow-sm'
                : 'text-muted-main hover:text-text-main'
            }`}
          >
            <Layers size={14} />
            <span>Pesatrix Portal</span>
          </button>
        </div>

        <button
          onClick={() => loadStats(true)}
          disabled={refreshing}
          className="bg-panel hover:bg-background border border-border-main rounded-xl text-text-main px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Details</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-semibold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Volume */}
        <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-accent/35 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-main uppercase tracking-wider">Total Volume (Success)</span>
            <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Activity size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold tracking-tight text-text-main">
              {formatKES(serviceData?.totalVolume || 0)}
            </h3>
            <span className="text-[10px] text-muted-main block mt-1">
              Combined Inflow & Outflow Transactions
            </span>
          </div>
        </div>

        {/* Card 2: Total Inflow */}
        <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-success-main/35 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-main uppercase tracking-wider">Total Inflow</span>
            <div className="w-8 h-8 rounded-lg bg-success-main/10 text-success-main flex items-center justify-center shrink-0">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold tracking-tight text-success-main">
              {formatKES(serviceData?.totalInflow || 0)}
            </h3>
            <span className="text-[10px] text-muted-main block mt-1">
              Today In: <strong className="text-text-main">{formatKES(serviceData?.inflowToday || 0)}</strong>
            </span>
          </div>
        </div>

        {/* Card 3: Total Outflow (B2C Payouts) */}
        <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-danger/35 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-main uppercase tracking-wider">Total Outflow</span>
            <div className="w-8 h-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center shrink-0">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold tracking-tight text-danger">
              {formatKES(serviceData?.totalOutflow || 0)}
            </h3>
            <span className="text-[10px] text-muted-main block mt-1">
              Today Out: <strong className="text-text-main">{formatKES(serviceData?.outflowToday || 0)}</strong>
            </span>
          </div>
        </div>

        {/* Card 4: Net Service Flow */}
        <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-warning-main/35 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-main uppercase tracking-wider">Net Flow</span>
            <div className="w-8 h-8 rounded-lg bg-warning-main/10 text-warning-main flex items-center justify-center shrink-0">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-xl font-bold tracking-tight ${
              (serviceData?.totalInflow - serviceData?.totalOutflow) >= 0 ? 'text-success-main' : 'text-danger'
            }`}>
              {formatKES(serviceData?.totalInflow - serviceData?.totalOutflow || 0)}
            </h3>
            <span className="text-[10px] text-muted-main block mt-1">
              Transaction count: <strong className="text-text-main">{serviceData?.txCount || 0}</strong> jobs
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts & Attribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Module Revenue Inbound Contribution */}
        <div className="lg:col-span-2 bg-panel border border-border-main rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-text-main">Inbound Revenue by Module</h3>
              <p className="text-xs text-muted-main">Aggregated collections across active {serviceLabel} features</p>
            </div>
            <TrendingUp size={16} className="text-accent" />
          </div>

          {moduleChartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-main">
              <Layers size={36} className="stroke-[1.5] mb-2 opacity-50" />
              <span className="text-xs">No module collections recorded for {serviceLabel}</span>
            </div>
          ) : (
            <>
              <div className="h-64 w-full text-xs mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                    <XAxis dataKey="name" stroke="var(--muted-main)" />
                    <YAxis stroke="var(--muted-main)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }}
                      formatter={(value) => [formatKES(value as number), 'Volume']}
                    />
                    <Bar dataKey="value" fill="#00BFFF" radius={[4, 4, 0, 0]} name="Volume (KES)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Module stats list */}
              <div className="border border-border-main rounded-xl overflow-hidden divide-y divide-border-main max-h-[300px] overflow-y-auto">
                {serviceData?.modules.map((m: any, idx: number) => {
                  const pct = serviceData.totalInflow > 0 ? (m.volume / serviceData.totalInflow) * 100 : 0;
                  return (
                    <div key={m.name} className="p-3 flex items-center justify-between text-xs hover:bg-background/40 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]" style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-bold text-text-main">{getReadableLabel(m.name)}</span>
                          <span className="text-[10px] text-muted-main block">Code: {m.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-text-main">{formatKES(m.volume)}</span>
                        <span className="text-[10px] text-muted-main block">{m.count} payments ({pct.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Transaction Types Share */}
        <div className="bg-panel border border-border-main rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-text-main">Transaction Type Distribution</h3>
            <p className="text-xs text-muted-main">Aggregated volumes and counts by payment flow type</p>
          </div>

          {typeChartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-main">
              <CreditCard size={36} className="stroke-[1.5] mb-2 opacity-50" />
              <span className="text-xs">No transaction records found</span>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              <div className="h-44 w-full flex items-center justify-center text-xs relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={moduleChartData.length > 0 ? moduleChartData : [{ name: 'No data', value: 0.1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {moduleChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }}
                      formatter={(value) => [formatKES(value as number), 'Volume']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <span className="text-[10px] text-muted-main font-bold uppercase tracking-wider block">Total Inflow</span>
                  <span className="text-sm font-bold text-text-main">{formatKES(serviceData?.totalInflow || 0)}</span>
                </div>
              </div>

              {/* List of Types */}
              <div className="space-y-3.5">
                {serviceData?.types.map((type: any, index: number) => {
                  const pct = serviceData.totalVolume > 0 ? (type.volume / serviceData.totalVolume) * 100 : 0;
                  return (
                    <div key={type.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-text-main uppercase tracking-wider">{type.name}</span>
                        <span className="font-bold text-text-main">{formatKES(type.volume)} <span className="text-muted-main font-normal text-[10px]">({type.count})</span></span>
                      </div>
                      <div className="w-full bg-background rounded-full h-1.5 overflow-hidden border border-border-main/40">
                        <div 
                          className="h-full rounded-full bg-accent" 
                          style={{ width: `${pct}%`, backgroundColor: COLORS[index % COLORS.length] }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: Recent B2C Payout Logs */}
      <div className="bg-panel border border-border-main rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-text-main">Recent {serviceLabel} B2C Payouts</h3>
            <p className="text-xs text-muted-main">Latest money out payout requests sent via {serviceLabel}</p>
          </div>
          <History size={16} className="text-danger" />
        </div>

        {(!serviceData?.recentPayouts || serviceData.recentPayouts.length === 0) ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-main text-xs border border-dashed border-border-main/55 rounded-xl">
            <ArrowDownLeft size={32} className="stroke-[1.5] mb-2 opacity-40 text-danger" />
            <span>No successful payouts recorded for {serviceLabel}</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-border-main rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-background border-b border-border-main text-muted-main font-semibold">
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4">Recipient Phone</th>
                  <th className="py-3 px-4">Account Reference</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payout Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {serviceData.recentPayouts.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-background/25 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-text-main">
                      {tx.mpesa_receipt || tx.receipt || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {tx.phone_number || tx.counterparty_phone || '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      {tx.account_reference || '—'}
                    </td>
                    <td className="py-3 px-4 font-bold text-danger">
                      -{formatKES(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-muted-main">
                      {new Date(tx.created_at).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success-main/15 text-success-main border border-success-main/20">
                        <CheckCircle2 size={10} />
                        <span>SUCCESS</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
