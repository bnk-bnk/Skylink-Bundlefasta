'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, Award, PhoneCall, ShieldAlert, BarChart3, HelpCircle } from 'lucide-react';
import { getAnalyticsAction } from '@/app/actions';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie
} from 'recharts';

const COLORS = ['#00BFFF', '#0DB02B', '#FF4500', '#FF3B30', '#6B7280'];

export default function AnalyticsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const anal = await getAnalyticsAction();
        setData(anal);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-panel border border-border-main rounded-xl p-5 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80 lg:col-span-2" />
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80 lg:col-span-1" />
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80 lg:col-span-1" />
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80 lg:col-span-1" />
          <div className="bg-panel border border-border-main rounded-xl p-5 h-80 lg:col-span-1" />
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || { revenueToday: 0, revenueWeek: 0, revenueMonth: 0, revenueYear: 0 };
  const charts = data?.charts || {
    revenueTrend: [],
    cashflowTrend: [],
    revenueBySource: [],
    topReferences: [],
    topPhoneNumbers: [],
    rates: { stkSuccessRate: 100, b2cSuccessRate: 100, reversalSuccessRate: 100 },
  };

  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Time-bound Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue Today', value: metrics.revenueToday },
          { label: 'Revenue This Week', value: metrics.revenueWeek },
          { label: 'Revenue This Month', value: metrics.revenueMonth },
          { label: 'Revenue This Year', value: metrics.revenueYear },
        ].map((m, i) => (
          <div key={i} className="bg-panel border border-border-main rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-semibold text-muted-main uppercase tracking-wider block">
              {m.label}
            </span>
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-text-main mt-2 font-mono">
              {formatKES(m.value)}
            </h3>
          </div>
        ))}
      </div>

      {/* 2. Success Rates Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { name: 'STK Success Rate', value: charts.rates.stkSuccessRate, color: 'text-accent bg-accent/10' },
          { name: 'B2C Success Rate', value: charts.rates.b2cSuccessRate, color: 'text-success-main bg-success-main/10' },
          { name: 'Reversal Success Rate', value: charts.rates.reversalSuccessRate, color: 'text-warning-main bg-warning-main/10' },
        ].map((rate, i) => (
          <div key={i} className="bg-panel border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-muted-main">{rate.name}</span>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-3xl font-extrabold text-text-main tracking-tight font-mono">
                {rate.value}%
              </span>
              <div className="flex-1 bg-background rounded-full h-2 overflow-hidden border border-border-main">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    rate.name.includes('STK') ? 'bg-accent' : rate.name.includes('B2C') ? 'bg-success-main' : 'bg-warning-main'
                  }`}
                  style={{ width: `${rate.value}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Deep Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Daily Inbound Payments (Bar Chart) */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-2 flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm">Revenue by Day</h3>
            <p className="text-xs text-muted-main">Aggregated inbound payments volume (KES)</p>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                <XAxis dataKey="date" stroke="var(--muted-main)" />
                <YAxis stroke="var(--muted-main)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                <Bar dataKey="revenue" fill="#00BFFF" radius={[4, 4, 0, 0]} name="Volume" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Account References */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <Award size={16} className="text-warning-main" />
              Top References
            </h3>
            <p className="text-xs text-muted-main">Highest volume billing accounts</p>
          </div>
          
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {charts.topReferences.length === 0 ? (
              <div className="text-center text-xs text-muted-main">No volume data registered yet.</div>
            ) : (
              charts.topReferences.map((ref: any, idx: number) => (
                <div key={ref.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="font-mono text-text-main font-bold">{ref.name}</span>
                    <span className="font-mono text-muted-main">{formatKES(ref.value)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5 overflow-hidden border border-border-main">
                    <div 
                      className="bg-accent h-full rounded-full" 
                      style={{ 
                        width: `${Math.round((ref.value / (charts.topReferences[0]?.value || 1)) * 100)}%` 
                      }} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Customers (Phones) */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <PhoneCall size={16} className="text-success-main" />
              Top Payers (Phones)
            </h3>
            <p className="text-xs text-muted-main">Phone numbers with largest aggregates</p>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {charts.topPhoneNumbers.length === 0 ? (
              <div className="text-center text-xs text-muted-main">No customer records yet.</div>
            ) : (
              charts.topPhoneNumbers.map((ph: any, idx: number) => (
                <div key={ph.phone} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="font-mono text-text-main font-bold">+{ph.phone}</span>
                    <span className="font-mono text-muted-main">{formatKES(ph.value)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5 overflow-hidden border border-border-main">
                    <div 
                      className="bg-success-main h-full rounded-full" 
                      style={{ 
                        width: `${Math.round((ph.value / (charts.topPhoneNumbers[0]?.value || 1)) * 100)}%` 
                      }} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Revenue stream breakdown (Donut) */}
        <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-1 flex flex-col">
          <div className="mb-2">
            <h3 className="font-bold text-sm">Product share</h3>
            <p className="text-xs text-muted-main">Volume distribution across mapped streams</p>
          </div>
          <div className="h-48 w-full flex items-center justify-center text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.revenueBySource}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  {charts.revenueBySource.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-muted-main font-semibold">
            {charts.revenueBySource.map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center gap-1.5 truncate">
                <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
