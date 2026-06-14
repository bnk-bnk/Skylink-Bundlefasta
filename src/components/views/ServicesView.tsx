'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  RefreshCw,
  Calendar,
  AlertCircle,
  TrendingUp,
  CreditCard,
  History,
  CheckCircle2,
  DollarSign,
  User,
  Users,
  Eye,
  X,
  FileText,
  ChevronRight,
  ShieldCheck,
  TrendingDown,
  Info
} from 'lucide-react';
import {
  getServicesOverviewAction,
  getBingwaOneModuleSummariesAction,
  getBingwaOneModuleDetailsAction,
  getPesatrixOverviewAction,
  getPesatrixEventDetailsAction
} from '@/app/actions';
import { humanizeIdentifier, getReadableLabel } from '@/lib/utils/labels';
import TransactionDetailDrawer from '@/components/shared/TransactionDetailDrawer';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

const COLORS = ['#00BFFF', '#0DB02B', '#FF4500', '#D000F0', '#FFCC00', '#FF3B30', '#6B7280'];

type PeriodType = 'today' | 'week' | 'month' | '30days' | 'custom';

export default function ServicesView() {
  const [activeTab, setActiveTab] = useState<'bingwaone' | 'pesatrix'>('bingwaone');
  const [pagePeriod, setPagePeriod] = useState<PeriodType>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Main page data
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [bingwaoneModules, setBingwaoneModules] = useState<any[]>([]);
  const [pesatrixOverview, setPesatrixOverview] = useState<any>(null);

  // Detail view state
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [pesatrixDetailType, setPesatrixDetailType] = useState<'activation' | 'withdrawal' | null>(null);

  // Modal specific period state
  const [modalPeriod, setModalPeriod] = useState<PeriodType>('30days');
  const [modalCustomStart, setModalCustomStart] = useState('');
  const [modalCustomEnd, setModalCustomEnd] = useState('');
  const [showModalCustomRange, setShowModalCustomRange] = useState(false);
  
  // Modal data state
  const [modalLoading, setModalLoading] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Transaction detail state (opens inside modal/drawer)
  const [selectedTx, setSelectedTx] = useState<any>(null);

  // Format currency helper
  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);
  };

  // Load parent overview and module summary lists
  const loadPageData = async (isRef = false) => {
    if (isRef) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [overviewRes, modulesRes, pesatrixRes] = await Promise.all([
        getServicesOverviewAction(pagePeriod, customStart, customEnd),
        getBingwaOneModuleSummariesAction(pagePeriod, customStart, customEnd),
        getPesatrixOverviewAction(pagePeriod, customStart, customEnd)
      ]);

      if (overviewRes.success && modulesRes.success && pesatrixRes.success) {
        setOverview(overviewRes as any);
        setBingwaoneModules((modulesRes as any).modules || []);
        setPesatrixOverview(pesatrixRes as any);
      } else {
        setError(overviewRes.error || modulesRes.error || pesatrixRes.error || 'Failed to retrieve services data');
      }
    } catch (err: any) {
      console.error('[ServicesView] Error loading data:', err);
      setError(err.message || 'An error occurred while loading services analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load details whenever modal selection or modal period changes
  const loadModalData = async () => {
    if (!selectedModule && !pesatrixDetailType) return;
    setModalLoading(true);
    setModalError(null);
    setModalData(null);

    try {
      if (selectedModule) {
        const res = await getBingwaOneModuleDetailsAction(selectedModule, modalPeriod, modalCustomStart, modalCustomEnd);
        if (res.success) {
          setModalData(res as any);
        } else {
          setModalError(res.error || `Failed to retrieve details for module ${selectedModule}`);
        }
      } else if (pesatrixDetailType) {
        const res = await getPesatrixEventDetailsAction(pesatrixDetailType, modalPeriod, modalCustomStart, modalCustomEnd);
        if (res.success) {
          setModalData(res as any);
        } else {
          setModalError(res.error || `Failed to retrieve details for Pesatrix ${pesatrixDetailType}`);
        }
      }
    } catch (err: any) {
      console.error('[ServicesView] Error loading modal data:', err);
      setModalError(err.message || 'An error occurred while loading detailed analysis.');
    } finally {
      setModalLoading(false);
    }
  };

  // Fetch page data on period change
  useEffect(() => {
    if (pagePeriod !== 'custom' || (customStart && customEnd)) {
      loadPageData();
    }
  }, [pagePeriod, customStart, customEnd]);

  // Fetch modal details on selection/modal-period change
  useEffect(() => {
    if (selectedModule || pesatrixDetailType) {
      if (modalPeriod !== 'custom' || (modalCustomStart && modalCustomEnd)) {
        loadModalData();
      }
    }
  }, [selectedModule, pesatrixDetailType, modalPeriod, modalCustomStart, modalCustomEnd]);

  // Sync modal period with main page period when a modal is opened
  const handleOpenModuleDetails = (moduleName: string) => {
    setModalPeriod(pagePeriod);
    setModalCustomStart(customStart);
    setModalCustomEnd(customEnd);
    setShowModalCustomRange(pagePeriod === 'custom');
    setSelectedModule(moduleName);
  };

  const handleOpenPesatrixDetails = (type: 'activation' | 'withdrawal') => {
    setModalPeriod(pagePeriod);
    setModalCustomStart(customStart);
    setModalCustomEnd(customEnd);
    setShowModalCustomRange(pagePeriod === 'custom');
    setPesatrixDetailType(type);
  };

  const trendColor = (changeStr: string) => {
    if (changeStr === 'New' || changeStr.startsWith('+')) return 'text-success-main';
    if (changeStr === 'No change' || changeStr === '0.0%' || changeStr === '0%') return 'text-muted-main';
    return 'text-danger';
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse font-outfit">
        <div className="flex justify-between items-center">
          <div className="h-10 bg-panel border border-border-main rounded-xl w-64" />
          <div className="h-10 bg-panel border border-border-main rounded-xl w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-panel border border-border-main rounded-2xl p-6 h-56" />
          <div className="bg-panel border border-border-main rounded-2xl p-6 h-56" />
        </div>
        <div className="h-6 bg-panel border border-border-main rounded-xl w-48 mt-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-panel border border-border-main rounded-2xl p-5 h-40" />
          ))}
        </div>
      </div>
    );
  }

  // Active Service context
  const b1Current = overview?.bingwaone?.current || {};
  const b1Change = overview?.bingwaone?.change || {};
  const ptCurrent = overview?.pesatrix?.current || {};
  const ptChange = overview?.pesatrix?.change || {};

  return (
    <div className="space-y-6 font-outfit antialiased">
      {/* Top Controls: Period selector & global filters */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 border-b border-border-main/55 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-text-main flex items-center gap-2">
            <Cpu className="text-accent shrink-0" size={20} />
            Services & Portal Modules
          </h1>
          <p className="text-xs text-muted-main mt-0.5">Dynamic transaction analytics for BingwaOne modules and Pesatrix services</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="flex bg-background border border-border-main p-1 rounded-xl shadow-sm">
            {(['today', 'week', 'month', '30days', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPagePeriod(p);
                  setShowCustomRange(p === 'custom');
                }}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                  pagePeriod === p
                    ? 'bg-panel text-accent border border-border-main/50 shadow-sm'
                    : 'text-muted-main hover:text-text-main'
                }`}
              >
                {p === '30days' ? 'Last 30 Days' : p}
              </button>
            ))}
          </div>

          {showCustomRange && (
            <div className="flex items-center gap-2 bg-panel border border-border-main rounded-xl p-1.5 shadow-sm">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent text-xs text-text-main border-none focus:outline-none px-1 font-semibold"
              />
              <span className="text-xs text-muted-main font-bold">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent text-xs text-text-main border-none focus:outline-none px-1 font-semibold"
              />
            </div>
          )}

          <button
            onClick={() => loadPageData(true)}
            disabled={refreshing}
            className="bg-panel hover:bg-background border border-border-main rounded-xl text-text-main px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-semibold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* PRIMARY SERVICE PARENT CARDS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* BingwaOne Parent Card */}
        <div className="bg-panel border border-border-main rounded-2xl p-6 shadow-md hover:border-accent/30 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Cpu size={120} />
          </div>
          <div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider bg-accent/10 px-2 py-0.5 rounded">Core Portal</span>
                <h2 className="text-xl font-extrabold text-text-main mt-1.5">BingwaOne Service</h2>
              </div>
              <Cpu className="text-accent" size={24} />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <span className="text-[10px] text-muted-main font-semibold uppercase tracking-wider">Total Inflow</span>
                <div className="text-xl font-extrabold text-success-main mt-0.5">{formatKES(b1Current.incoming || 0)}</div>
                <span className={`text-[10px] font-bold ${trendColor(b1Change.incoming)}`}>{b1Change.incoming}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-main font-semibold uppercase tracking-wider">Total Outflow</span>
                <div className="text-xl font-extrabold text-danger mt-0.5">{formatKES(b1Current.outgoing || 0)}</div>
                <span className={`text-[10px] font-bold ${trendColor(b1Change.outgoing)}`}>{b1Change.outgoing}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-main font-semibold uppercase tracking-wider">Net Flow</span>
                <div className={`text-xl font-extrabold mt-0.5 ${b1Current.netFlow >= 0 ? 'text-success-main' : 'text-danger'}`}>
                  {formatKES(b1Current.netFlow || 0)}
                </div>
                <span className={`text-[10px] font-bold ${trendColor(b1Change.netFlow)}`}>{b1Change.netFlow}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-main font-semibold uppercase tracking-wider">Tx Count</span>
                <div className="text-xl font-extrabold text-text-main mt-0.5">{b1Current.count || 0}</div>
                <span className={`text-[10px] font-bold ${trendColor(b1Change.count)}`}>{b1Change.count}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border-main/50 pt-4 mt-6 flex justify-between items-center text-[10px] text-muted-main">
            <div>
              <span>Avg Incoming: <strong>{formatKES(b1Current.avgIncoming || 0)}</strong></span>
            </div>
            <div>
              <span>Last Active: <strong>{b1Current.lastTime ? new Date(b1Current.lastTime).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : 'Never'}</strong></span>
            </div>
          </div>
        </div>

        {/* Pesatrix Parent Card */}
        <div className="bg-panel border border-border-main rounded-2xl p-6 shadow-md hover:border-warning-main/30 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Layers size={120} />
          </div>
          <div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-warning-main uppercase tracking-wider bg-warning-main/10 px-2 py-0.5 rounded">Core Ledger</span>
                <h2 className="text-xl font-extrabold text-text-main mt-1.5">Pesatrix Service</h2>
              </div>
              <Layers className="text-warning-main" size={24} />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <span className="text-[10px] text-muted-main font-semibold uppercase tracking-wider">Activation In</span>
                <div className="text-xl font-extrabold text-success-main mt-0.5">{formatKES(ptCurrent.incoming || 0)}</div>
                <span className={`text-[10px] font-bold ${trendColor(ptChange.incoming)}`}>{ptChange.incoming}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-main font-semibold uppercase tracking-wider">Withdrawal Out</span>
                <div className="text-xl font-extrabold text-danger mt-0.5">{formatKES(ptCurrent.outgoing || 0)}</div>
                <span className={`text-[10px] font-bold ${trendColor(ptChange.outgoing)}`}>{ptChange.outgoing}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-main font-semibold uppercase tracking-wider">Net Flow</span>
                <div className={`text-xl font-extrabold mt-0.5 ${ptCurrent.netFlow >= 0 ? 'text-success-main' : 'text-danger'}`}>
                  {formatKES(ptCurrent.netFlow || 0)}
                </div>
                <span className={`text-[10px] font-bold ${trendColor(ptChange.netFlow)}`}>{ptChange.netFlow}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-main font-semibold uppercase tracking-wider">Out-to-In Ratio</span>
                <div className="text-xl font-extrabold text-text-main mt-0.5">
                  {pesatrixOverview?.summary?.withdrawalToActivationRatio ? `${pesatrixOverview.summary.withdrawalToActivationRatio.toFixed(1)}%` : '0%'}
                </div>
                <span className="text-[9px] text-muted-main">Ratio of outflows to inflows</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border-main/50 pt-4 mt-6 flex justify-between items-center text-[10px] text-muted-main">
            <div>
              <span>Jobs Count: <strong>Activations: {pesatrixOverview?.summary?.activationCount || 0} / Payouts: {pesatrixOverview?.summary?.withdrawalCount || 0}</strong></span>
            </div>
            <div>
              <span>Last Active: <strong>{ptCurrent.lastTime ? new Date(ptCurrent.lastTime).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : 'Never'}</strong></span>
            </div>
          </div>
        </div>

      </div>

      {/* PORTAL SPECIFIC DETAILS SELECTOR */}
      <div className="flex bg-background border border-border-main p-1 rounded-xl shadow-sm self-start inline-flex mt-4">
        <button
          onClick={() => setActiveTab('bingwaone')}
          className={`text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'bingwaone'
              ? 'bg-panel text-accent border border-border-main/50 shadow-sm'
              : 'text-muted-main hover:text-text-main'
          }`}
        >
          <Cpu size={14} />
          <span>BingwaOne Portal ({bingwaoneModules.length} Modules)</span>
        </button>
        <button
          onClick={() => setActiveTab('pesatrix')}
          className={`text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'pesatrix'
              ? 'bg-panel text-warning-main border border-border-main/50 shadow-sm'
              : 'text-muted-main hover:text-text-main'
          }`}
        >
          <Layers size={14} />
          <span>Pesatrix Portal Overview</span>
        </button>
      </div>

      {/* BINGWAONE DETAILS TAB CONTENT */}
      {activeTab === 'bingwaone' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-text-main">BingwaOne Dynamic Modules</h3>
              <p className="text-xs text-muted-main">Self-discovering cards aggregated dynamically from canonical transactions</p>
            </div>
          </div>

          {bingwaoneModules.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-muted-main text-xs bg-panel border border-dashed border-border-main rounded-2xl">
              <Cpu size={48} className="stroke-[1.5] mb-3 opacity-40 text-accent" />
              <span className="font-bold">No BingwaOne modules recorded yet</span>
              <span className="text-[10px] text-muted-main/75 mt-0.5">Transactions with source system 'bingwaone' will dynamically generate modules here.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {bingwaoneModules.map((m: any, idx: number) => {
                const avg = m.avgIncoming || 0;
                return (
                  <motion.div
                    key={m.module}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleOpenModuleDetails(m.module)}
                    className="bg-panel border border-border-main hover:border-accent/40 rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-xs text-text-main truncate group-hover:text-accent transition-colors">
                          {humanizeIdentifier(m.module)}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                          {m.pctOfTotal.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-main mt-0.5 font-mono">ID: {m.module}</p>
                    </div>

                    <div className="mt-4">
                      <span className="text-[9px] text-muted-main font-semibold uppercase tracking-wider block">Incoming Revenue</span>
                      <h4 className="text-base font-extrabold text-text-main mt-0.5">{formatKES(m.incoming)}</h4>
                      
                      <div className="flex justify-between items-center text-[10px] text-muted-main mt-3 border-t border-border-main/50 pt-2 font-medium">
                        <span>{m.count} txs</span>
                        <span className={`font-semibold ${trendColor(m.change)}`}>{m.change}</span>
                      </div>
                    </div>

                    <div className="mt-3 w-full bg-background rounded-full h-1 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-accent" 
                        style={{ width: `${m.pctOfTotal}%`, backgroundColor: COLORS[idx % COLORS.length] }} 
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESATRIX DETAILS TAB CONTENT */}
      {activeTab === 'pesatrix' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-sm text-text-main">Pesatrix Ledger Module Breakdown</h3>
            <p className="text-xs text-muted-main font-semibold">Separate Activations and Withdrawals cards for specific ledger flows</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Activation Card */}
            <div 
              onClick={() => handleOpenPesatrixDetails('activation')}
              className="bg-panel border border-border-main hover:border-success-main/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-success-main uppercase tracking-wider bg-success-main/10 px-2.5 py-0.5 rounded">Ledger Inflow</span>
                  <ArrowUpRight className="text-success-main" size={20} />
                </div>
                <h3 className="text-lg font-extrabold text-text-main mt-3 group-hover:text-success-main transition-colors">Activation Ledger</h3>
                <p className="text-xs text-muted-main mt-0.5">Registration and onboarding fees processed on Pesatrix</p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border-main/50 pt-4">
                <div>
                  <span className="text-[10px] text-muted-main uppercase font-semibold">Revenue</span>
                  <div className="text-lg font-extrabold text-text-main mt-0.5">
                    {formatKES(pesatrixOverview?.activation?.revenue || 0)}
                  </div>
                  <span className={`text-[10px] font-bold ${trendColor(pesatrixOverview?.activation?.change)}`}>
                    {pesatrixOverview?.activation?.change}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-main uppercase font-semibold">Count</span>
                  <div className="text-lg font-extrabold text-text-main mt-0.5">
                    {pesatrixOverview?.activation?.count || 0}
                  </div>
                  <span className={`text-[10px] font-bold ${trendColor(pesatrixOverview?.activation?.countChange)}`}>
                    {pesatrixOverview?.activation?.countChange}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center text-[10px] text-muted-main">
                <span>Avg Activation: <strong>{formatKES(pesatrixOverview?.activation?.avgAmount || 0)}</strong></span>
                <span>Latest: <strong>{pesatrixOverview?.activation?.latestTime ? new Date(pesatrixOverview.activation.latestTime).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : 'Never'}</strong></span>
              </div>
            </div>

            {/* Withdrawal Card */}
            <div 
              onClick={() => handleOpenPesatrixDetails('withdrawal')}
              className="bg-panel border border-border-main hover:border-danger/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-danger uppercase tracking-wider bg-danger/10 px-2.5 py-0.5 rounded">Ledger Outflow</span>
                  <ArrowDownLeft className="text-danger" size={20} />
                </div>
                <h3 className="text-lg font-extrabold text-text-main mt-3 group-hover:text-danger transition-colors">Withdrawal Ledger</h3>
                <p className="text-xs text-muted-main mt-0.5">Payouts and wallet withdrawal transactions on Pesatrix</p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border-main/50 pt-4">
                <div>
                  <span className="text-[10px] text-muted-main uppercase font-semibold">Amount Out</span>
                  <div className="text-lg font-extrabold text-text-main mt-0.5">
                    {formatKES(pesatrixOverview?.withdrawal?.outflow || 0)}
                  </div>
                  <span className={`text-[10px] font-bold ${trendColor(pesatrixOverview?.withdrawal?.change)}`}>
                    {pesatrixOverview?.withdrawal?.change}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-main uppercase font-semibold">Count</span>
                  <div className="text-lg font-extrabold text-text-main mt-0.5">
                    {pesatrixOverview?.withdrawal?.count || 0}
                  </div>
                  <span className={`text-[10px] font-bold ${trendColor(pesatrixOverview?.withdrawal?.countChange)}`}>
                    {pesatrixOverview?.withdrawal?.countChange}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center text-[10px] text-muted-main">
                <span>Avg Withdrawal: <strong>{formatKES(pesatrixOverview?.withdrawal?.avgAmount || 0)}</strong></span>
                <span>Latest: <strong>{pesatrixOverview?.withdrawal?.latestTime ? new Date(pesatrixOverview.withdrawal.latestTime).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : 'Never'}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL DRAWER OVERLAYS */}
      <AnimatePresence>
        {(selectedModule || pesatrixDetailType) && (
          <div className="fixed inset-0 z-40 flex justify-end font-outfit">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedModule(null);
                setPesatrixDetailType(null);
              }}
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            />

            {/* Modal Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-4xl bg-panel border-l border-border-main p-6 shadow-2xl overflow-y-auto h-full flex flex-col justify-between"
            >
              <div>
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-border-main pb-4 mb-6">
                  <div>
                    <h3 className="font-extrabold text-base text-text-main flex items-center gap-2">
                      {selectedModule ? (
                        <>
                          <Cpu className="text-accent" size={18} />
                          <span>{humanizeIdentifier(selectedModule)} Module Analysis</span>
                        </>
                      ) : (
                        <>
                          <Layers className="text-warning-main" size={18} />
                          <span>Pesatrix {humanizeIdentifier(pesatrixDetailType)} Analysis</span>
                        </>
                      )}
                    </h3>
                    <p className="text-[10px] text-muted-main mt-0.5 uppercase tracking-wide">
                      {selectedModule ? `Module Component: ${selectedModule}` : `Ledger stream: pesatrix_${pesatrixDetailType}`}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Modal-level Period Controls */}
                    <div className="flex bg-background border border-border-main p-0.5 rounded-lg shadow-sm">
                      {(['today', 'week', 'month', '30days', 'custom'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setModalPeriod(p);
                            setShowModalCustomRange(p === 'custom');
                          }}
                          className={`text-[10px] px-2 py-1 rounded font-bold capitalize transition-all cursor-pointer ${
                            modalPeriod === p
                              ? 'bg-panel text-accent shadow-sm'
                              : 'text-muted-main hover:text-text-main'
                          }`}
                        >
                          {p === '30days' ? '30d' : p}
                        </button>
                      ))}
                    </div>

                    {showModalCustomRange && (
                      <div className="flex items-center gap-1.5 bg-background border border-border-main rounded-lg p-1 shadow-sm">
                        <input
                          type="date"
                          value={modalCustomStart}
                          onChange={(e) => setModalCustomStart(e.target.value)}
                          className="bg-transparent text-[10px] text-text-main border-none focus:outline-none w-20 font-bold"
                        />
                        <span className="text-[10px] text-muted-main font-bold">to</span>
                        <input
                          type="date"
                          value={modalCustomEnd}
                          onChange={(e) => setModalCustomEnd(e.target.value)}
                          className="bg-transparent text-[10px] text-text-main border-none focus:outline-none w-20 font-bold"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSelectedModule(null);
                        setPesatrixDetailType(null);
                      }}
                      className="p-1.5 hover:bg-background rounded-lg border border-border-main transition-colors text-muted-main hover:text-text-main cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                {modalLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-8 h-8 text-accent animate-spin" />
                    <span className="text-xs text-muted-main font-bold">Aggregating statistics on server...</span>
                  </div>
                ) : modalError ? (
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-semibold flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                ) : !modalData ? (
                  <div className="py-20 flex flex-col items-center justify-center text-muted-main text-xs border border-dashed border-border-main rounded-xl">
                    <Calendar size={36} className="stroke-[1.5] mb-2 opacity-50" />
                    <span>No transactions recorded for the selected range.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-background border border-border-main rounded-xl p-4">
                        <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">
                          {selectedModule ? 'Revenue Volume' : pesatrixDetailType === 'activation' ? 'Activation Revenue' : 'Withdrawal Outflow'}
                        </span>
                        <h4 className="text-base font-extrabold text-text-main mt-1">
                          {formatKES(selectedModule ? modalData.metrics.incoming : modalData.metrics.volume)}
                        </h4>
                        <span className={`text-[10px] font-bold block mt-0.5 ${trendColor(selectedModule ? modalData.metrics.change.incoming : modalData.metrics.change.volume)}`}>
                          {selectedModule ? modalData.metrics.change.incoming : modalData.metrics.change.volume}
                        </span>
                      </div>

                      <div className="bg-background border border-border-main rounded-xl p-4">
                        <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">Transaction Count</span>
                        <h4 className="text-base font-extrabold text-text-main mt-1">
                          {modalData.metrics.count} txs
                        </h4>
                        <span className={`text-[10px] font-bold block mt-0.5 ${trendColor(selectedModule ? modalData.metrics.change.count : modalData.metrics.change.count)}`}>
                          {selectedModule ? modalData.metrics.change.count : modalData.metrics.change.count}
                        </span>
                      </div>

                      <div className="bg-background border border-border-main rounded-xl p-4">
                        <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">Average Transaction</span>
                        <h4 className="text-base font-extrabold text-text-main mt-1">
                          {formatKES(selectedModule ? modalData.metrics.avgIncoming : modalData.metrics.avgAmount)}
                        </h4>
                        <span className={`text-[10px] font-bold block mt-0.5 ${trendColor(selectedModule ? modalData.metrics.change.avgIncoming : modalData.metrics.change.avgAmount)}`}>
                          {selectedModule ? modalData.metrics.change.avgIncoming : modalData.metrics.change.avgAmount}
                        </span>
                      </div>

                      <div className="bg-background border border-border-main rounded-xl p-4">
                        <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">Highest / Lowest</span>
                        <h4 className="text-xs font-bold text-text-main mt-1.5 flex flex-col">
                          <span>Max: {formatKES(selectedModule ? modalData.metrics.highestIncoming : modalData.metrics.highestAmount)}</span>
                          <span className="text-[10px] text-muted-main mt-0.5">Min: {formatKES(selectedModule ? modalData.metrics.lowestIncoming : modalData.metrics.lowestAmount)}</span>
                        </h4>
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-background/50 border border-border-main/55 rounded-xl p-4 text-xs font-semibold">
                      <div className="flex justify-between items-center border-b border-border-main/30 pb-2 lg:border-none lg:pb-0">
                        <span className="text-[10px] text-muted-main">First Recorded (in range)</span>
                        <span className="text-text-main font-mono">
                          {modalData.metrics.firstTxTime ? new Date(modalData.metrics.firstTxTime).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 lg:pt-0">
                        <span className="text-[10px] text-muted-main">Latest Recorded (in range)</span>
                        <span className="text-text-main font-mono">
                          {modalData.metrics.latestTxTime || modalData.metrics.firstTxTime ? new Date(modalData.metrics.latestTxTime || modalData.metrics.firstTxTime).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Trend Time Series Chart */}
                    <div className="bg-background/40 border border-border-main rounded-xl p-4">
                      <span className="text-[10px] font-bold text-muted-main uppercase tracking-wider block mb-3">Volume Trend Over Time</span>
                      <div className="h-60 w-full text-xs font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={selectedModule ? modalData.chartData : modalData.trendData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00BFFF" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#00BFFF" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} />
                            <XAxis dataKey="label" stroke="var(--muted-main)" />
                            <YAxis stroke="var(--muted-main)" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--border-main)', color: 'var(--text-main)', borderRadius: '12px' }} formatter={(v) => [formatKES(Number(v)), 'Amount']} />
                            <Area type="monotone" dataKey="incoming" stroke="#00BFFF" fillOpacity={1} fill="url(#colorInflow)" strokeWidth={2} name="Volume (KES)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Dynamic breakdowns and lists based on context */}
                    {selectedModule ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Revenue by Payment Type */}
                        <div className="bg-background/40 border border-border-main rounded-xl p-4 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-muted-main uppercase tracking-wider block mb-3">Revenue by Payment Type</span>
                            <div className="space-y-3">
                              {modalData.paymentTypeBreakdown.length === 0 ? (
                                <span className="text-[11px] text-muted-main italic block py-4 text-center">No payment types registered</span>
                              ) : (
                                modalData.paymentTypeBreakdown.map((t: any, index: number) => (
                                  <div key={t.paymentType} className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold text-text-main">
                                      <span>{humanizeIdentifier(t.paymentType)}</span>
                                      <span>{formatKES(t.incoming)} <span className="text-muted-main font-normal text-[10px]">({t.count} txs)</span></span>
                                    </div>
                                    <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                                      <div 
                                        className="h-full rounded-full bg-accent"
                                        style={{ width: `${t.pct}%`, backgroundColor: COLORS[index % COLORS.length] }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-[9px] text-muted-main font-semibold">
                                      <span>Avg: {formatKES(t.avg)}</span>
                                      <span className={trendColor(t.change)}>{t.change}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Top Agents List */}
                        <div className="bg-background/40 border border-border-main rounded-xl p-4">
                          <span className="text-[10px] font-bold text-muted-main uppercase tracking-wider block mb-3">Top Attributed Agents (Volume & Count)</span>
                          {modalData.topAgentsByVolume.length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-main italic">
                              <Users className="mx-auto opacity-30 mb-1.5" size={24} />
                              <span>No agent attributions found for this module</span>
                            </div>
                          ) : (
                            <div className="space-y-3.5">
                              {modalData.topAgentsByVolume.map((a: any, idx: number) => {
                                const countRank = modalData.topAgentsByCount.findIndex((x: any) => x.name === a.name) + 1;
                                return (
                                  <div key={a.name} className="flex justify-between items-center text-xs border-b border-border-main/30 pb-2 last:border-none last:pb-0">
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded bg-accent/10 text-accent flex items-center justify-center font-bold text-[9px] shrink-0">
                                        {idx + 1}
                                      </div>
                                      <div>
                                        <span className="font-bold text-text-main">{a.name}</span>
                                        <span className="text-[9px] text-muted-main block">@{a.username || 'agent'}</span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-text-main">{formatKES(a.volume)}</span>
                                      <span className="text-[9px] text-muted-main block">{a.count} txs (Rank #{countRank} by count)</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Recent Transactions List Table */}
                    <div className="bg-background/40 border border-border-main rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-muted-main uppercase tracking-wider block">Recent Activity Log (Success)</span>
                        <History size={14} className="text-muted-main" />
                      </div>
                      
                      {modalData.recentTransactions.length === 0 ? (
                        <div className="py-10 text-center text-xs text-muted-main italic">No transactions recorded in log</div>
                      ) : (
                        <div className="overflow-x-auto border border-border-main rounded-xl">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-background border-b border-border-main text-muted-main font-semibold">
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3">Receipt</th>
                                <th className="py-2.5 px-3">Payment Type</th>
                                <th className="py-2.5 px-3">Reference / Phone</th>
                                <th className="py-2.5 px-3 text-right">Amount</th>
                                <th className="py-2.5 px-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-main">
                              {modalData.recentTransactions.map((tx: any) => (
                                <tr key={tx.id} className="hover:bg-background/20 transition-colors">
                                  <td className="py-2 px-3 text-muted-main whitespace-nowrap">
                                    {new Date(tx.occurred_at || tx.created_at).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-bold text-text-main">
                                    {tx.receipt || tx.mpesa_receipt || '—'}
                                  </td>
                                  <td className="py-2 px-3 capitalize font-semibold">
                                    {humanizeIdentifier(tx.payment_type || tx.transaction_type)}
                                  </td>
                                  <td className="py-2 px-3 font-medium">
                                    <div>{tx.account_reference || '—'}</div>
                                    <div className="text-[9px] text-muted-main font-mono mt-0.5">{tx.phone_number || tx.payer_phone || tx.recipient_phone || '—'}</div>
                                  </td>
                                  <td className={`py-2 px-3 text-right font-bold font-mono ${tx.direction === 'IN' ? 'text-success-main' : 'text-danger'}`}>
                                    {tx.direction === 'IN' ? '+' : '-'}{formatKES(Number(tx.amount))}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      onClick={() => setSelectedTx(tx)}
                                      className="p-1 hover:bg-background border border-border-main rounded-md text-muted-main hover:text-accent cursor-pointer transition-colors"
                                      title="View Canonical Details"
                                    >
                                      <Eye size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CANONICAL DETAILS OVERLAY DIALOG */}
      {selectedTx && (
        <TransactionDetailDrawer
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}
