import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { supabase } from '../utils/supabaseClient';

export function KPICards() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any[]>([]);

  const calculateKPIs = (transactions: any[]) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Filter transactions by periods
    const currentPeriod = transactions.filter(t => new Date(t.occurred_at) >= thirtyDaysAgo);
    const previousPeriod = transactions.filter(t => {
      const date = new Date(t.occurred_at);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });

    // 1. Total Collections
    const getCollections = (list: any[]) => list
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const curCollections = getCollections(currentPeriod);
    const prevCollections = getCollections(previousPeriod);
    const collChange = prevCollections > 0 ? ((curCollections - prevCollections) / prevCollections * 100).toFixed(1) : '0.0';

    // 2. Successful STK Pushes
    const getSTKSuccess = (list: any[]) => list
      .filter(t => t.transaction_type === 'STK_PUSH' && t.status === 'completed')
      .length;
    const curSTK = getSTKSuccess(currentPeriod);
    const prevSTK = getSTKSuccess(previousPeriod);
    const stkChange = prevSTK > 0 ? ((curSTK - prevSTK) / prevSTK * 100).toFixed(1) : '0.0';

    // 3. Failed Transactions
    const getFailed = (list: any[]) => list
      .filter(t => t.status === 'failed')
      .length;
    const curFailed = getFailed(currentPeriod);
    const prevFailed = getFailed(previousPeriod);
    const failedChange = prevFailed > 0 ? ((curFailed - prevFailed) / prevFailed * 100).toFixed(1) : '0.0';

    // 4. Pending Reconciliation
    const getPending = (list: any[]) => list
      .filter(t => ['orphaned', 'duplicate', 'delayed'].includes(t.status))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const curPending = getPending(currentPeriod);
    const prevPending = getPending(previousPeriod);
    const pendingChange = prevPending > 0 ? ((curPending - prevPending) / prevPending * 100).toFixed(1) : '0.0';

    // Total lifetime values (all transactions in database)
    const totalCollections = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalSTKSuccess = transactions
      .filter(t => t.transaction_type === 'STK_PUSH' && t.status === 'completed')
      .length;

    const totalFailed = transactions
      .filter(t => t.status === 'failed')
      .length;

    const totalPending = transactions
      .filter(t => ['orphaned', 'duplicate', 'delayed'].includes(t.status))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return [
      {
        title: 'Total Collections',
        value: `KES ${totalCollections.toLocaleString()}`,
        change: `${Number(collChange) >= 0 ? '+' : ''}${collChange}%`,
        isPositive: Number(collChange) >= 0,
        active: false,
        icon: Activity,
        tooltip: 'Total inflow of funds via M-Pesa channels. Calculated dynamically from completed transaction records.'
      },
      {
        title: 'Successful STK Pushes',
        value: totalSTKSuccess.toLocaleString(),
        change: `${Number(stkChange) >= 0 ? '+' : ''}${stkChange}%`,
        isPositive: Number(stkChange) >= 0,
        active: true,
        icon: TrendingUp,
        tooltip: 'Number of M-Pesa Express (STK Push) requests successfully completed by customers.'
      },
      {
        title: 'Failed Transactions',
        value: totalFailed.toLocaleString(),
        change: `${Number(failedChange) <= 0 ? '-' : '+'}${Math.abs(Number(failedChange))}%`,
        isPositive: Number(failedChange) <= 0, // Lower failed rate is positive
        active: false,
        icon: AlertCircle,
        tooltip: 'Total failed transactions including STK push timeouts, insufficient funds, and C2B validation errors.'
      },
      {
        title: 'Pending Reconciliation',
        value: `KES ${totalPending.toLocaleString()}`,
        change: `${Number(pendingChange) <= 0 ? '-' : '+'}${Math.abs(Number(pendingChange))}%`,
        isPositive: Number(pendingChange) <= 0, // Lower pending rate is positive
        active: false,
        icon: TrendingDown,
        tooltip: 'Total monetary value currently mismatched or orphaned between Safaricom callbacks and customers.'
      }
    ];
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, status, transaction_type, occurred_at');

      if (error) throw error;
      setKpis(calculateKPIs(data || []));
    } catch (err) {
      console.error('Error fetching transactions for KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    const channel = supabase
      .channel('kpi-cards-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[148px] bg-brand-panel border border-brand-border rounded-2xl animate-pulse flex items-center justify-center">
            <RefreshCw className="text-brand-text/20 animate-spin" size={24} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex md:grid overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 snap-x snap-mandatory scrollbar-none">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div key={idx} className="w-[85vw] sm:w-[320px] md:w-auto shrink-0 snap-center h-full">
            <Tooltip content={
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-brand-bg/20 pb-2">
                  <span className="font-semibold opacity-90">{kpi.title}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${kpi.isPositive ? 'bg-status-success text-white' : 'bg-status-danger text-white'}`}>
                    {kpi.change}
                  </span>
                </div>
                <p className="text-xs opacity-80 leading-snug">{kpi.tooltip}</p>
                <div className="pt-1 font-mono text-[10px] opacity-60">Exact Value: {kpi.value}</div>
              </div>
            }>
              <div 
                className={`
                  w-full h-full p-6 rounded-2xl bg-brand-panel border transition-all duration-300 shadow-sm
                  ${kpi.active 
                    ? 'border-brand-accent shadow-[0_0_15px_rgba(0,191,255,0.2)]' 
                    : 'border-brand-border hover:border-brand-text/30'}
                `}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-brand-text/70 font-medium text-sm">{kpi.title}</span>
                  <div className={`p-2 rounded-lg bg-brand-bg ${kpi.active ? 'text-brand-accent' : 'text-brand-text/50'}`}>
                    <Icon size={18} />
                  </div>
                </div>
                
                <div className="flex items-end gap-3">
                  <h3 className="text-3xl font-bold text-brand-text tracking-wide">{kpi.value}</h3>
                </div>
                
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded-md font-medium ${kpi.isPositive ? 'bg-status-success/15 text-status-success' : 'bg-status-danger/15 text-status-danger'}`}>
                    {kpi.change}
                  </span>
                  <span className="text-brand-text/50">vs last period</span>
                </div>
              </div>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
