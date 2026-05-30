'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Wallet, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { getDashboardStatsAction, refreshBalanceAction, getAnalyticsAction } from '@/app/actions';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function BalanceView() {
  const [balance, setBalance] = useState<number | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const stats = await getDashboardStatsAction();
      setBalance(stats.balance);
      setLastRefreshed(stats.lastRefresh);
      
      const anal = await getAnalyticsAction();
      setHistory(anal.charts.balanceTrend || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load balance indicators.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await refreshBalanceAction();
      if (res.success) {
        setBalance(res.balance || 0);
        setLastRefreshed(res.fetchedAt || null);
        // Refresh chart history
        const anal = await getAnalyticsAction();
        setHistory(anal.charts.balanceTrend || []);
      } else {
        setError(res.error || 'Failed to communicate with M-Pesa endpoints.');
      }
    } catch (err: any) {
      setError(err.message || 'Network communication failure.');
    } finally {
      setRefreshing(false);
    }
  };

  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);
  };

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Balance Display Card */}
        <div className="bg-panel border border-border-main rounded-xl p-6 shadow-sm flex flex-col justify-between md:col-span-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-main uppercase tracking-wider">Account Balance</span>
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <Wallet size={20} />
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl font-extrabold text-text-main tracking-tight font-mono">
                {balance !== null ? formatKES(balance) : 'KES 0.00'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-main">
                <Clock size={12} />
                <span>
                  {lastRefreshed 
                    ? `Last refresh: ${new Date(lastRefreshed).toLocaleString('en-KE')}`
                    : 'Never refreshed'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-danger/10 text-danger border border-danger/20 rounded-lg text-xs font-medium">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-sm transition-all active:scale-[0.98]"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Polling Safaricom...' : 'Refresh Balance Now'}
            </button>
          </div>
        </div>

        {/* History Overview Card */}
        <div className="bg-panel border border-border-main rounded-xl p-6 shadow-sm md:col-span-2 flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              Balance History Snapshots
            </h3>
            <p className="text-xs text-muted-main">Historical trend based on verified Safaricom polls</p>
          </div>

          <div className="flex-1 min-h-[220px] w-full text-xs">
            {history.length <= 1 ? (
              <div className="h-full flex items-center justify-center text-muted-main">
                Insufficient data to render historical snapshots. Refreshes will build history.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalanceArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00BFFF" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#00BFFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                  <XAxis dataKey="date" stroke="var(--muted-main)" />
                  <YAxis stroke="var(--muted-main)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} />
                  <Area type="monotone" dataKey="balance" stroke="#00BFFF" strokeWidth={2} fillOpacity={1} fill="url(#colorBalanceArea)" name="Balance" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
