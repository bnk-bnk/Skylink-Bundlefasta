'use client';

import React, { useEffect, useState } from 'react';
import { History, Shield, Server, User, Search, RefreshCw, X, Eye, Info, Database, Layers } from 'lucide-react';
import { getAuditLogsAction } from '@/app/actions';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuditView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal States
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [modalDetails, setModalDetails] = useState<{
    loading: boolean;
    resultingBalance: number | null;
    matchingTx: any | null;
  }>({
    loading: false,
    resultingBalance: null,
    matchingTx: null
  });

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogsAction(100);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleOpenDetails = async (log: any) => {
    setSelectedLog(log);
    setModalDetails({ loading: true, resultingBalance: null, matchingTx: null });

    try {
      const supabase = createClient();
      
      // 1. Fetch resulting balance snapshot immediately following this log
      const { data: balanceData } = await supabase
        .from('balance_snapshots')
        .select('balance, fetched_at')
        .gte('fetched_at', log.created_at)
        .order('fetched_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      let resBalance = balanceData?.balance || null;
      if (!resBalance) {
        const { data: latestBalance } = await supabase
          .from('balance_snapshots')
          .select('balance')
          .order('fetched_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resBalance = latestBalance?.balance || null;
      }

      // 2. Lookup cross-referenced transaction
      const meta = log.metadata || {};
      const receipt = meta.receipt || meta.mpesa_receipt || meta.mpesaReceipt || meta.mpesaReceiptNumber || meta.MpesaReceiptNumber;
      const checkoutId = meta.checkoutRequestId || meta.checkout_request_id || meta.CheckoutRequestID;
      const originatorId = meta.originatorConversationId || meta.OriginatorConversationID;

      let matchingTx = null;
      if (receipt || checkoutId || originatorId) {
        let query = supabase.from('transactions').select('*');
        if (receipt) {
          query = query.eq('mpesa_receipt', receipt);
        } else if (checkoutId) {
          query = query.eq('checkout_request_id', checkoutId);
        } else if (originatorId) {
          query = query.eq('originator_conversation_id', originatorId);
        }
        const { data: txData } = await query.limit(1).maybeSingle();
        matchingTx = txData || null;
      }

      setModalDetails({
        loading: false,
        resultingBalance: resBalance,
        matchingTx
      });

    } catch (err) {
      console.error('Error fetching log parameters:', err);
      setModalDetails(prev => ({ ...prev, loading: false }));
    }
  };

  const renderDetails = (meta: any) => {
    if (!meta) return '-';
    try {
      return Object.entries(meta)
        .filter(([key]) => key !== 'operator_email')
        .map(([key, val]) => {
          const cleanKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
          return `${cleanKey}: ${typeof val === 'object' ? JSON.stringify(val) : val}`;
        })
        .join(' | ');
    } catch {
      return JSON.stringify(meta);
    }
  };

  const filteredLogs = logs.filter(log => {
    const act = log.action.toLowerCase();
    const email = log.metadata?.operator_email?.toLowerCase() || 'system';
    const query = search.toLowerCase();
    return act.includes(query) || email.includes(query);
  });

  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);
  };

  return (
    <div className="space-y-4 font-outfit antialiased">
      
      {/* Search Logs Bar */}
      <div className="bg-panel border border-border-main rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-muted-main" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
            placeholder="Search action or operator email..."
          />
        </div>
        
        <button
          onClick={loadLogs}
          className="flex items-center justify-center p-2 border border-border-main text-muted-main hover:text-text-main hover:bg-background rounded-lg transition-colors shrink-0 cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Logs Table Container */}
      <div className="bg-panel border border-border-main rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-main bg-background text-[10px] font-semibold text-muted-main uppercase tracking-wider">
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Event Action</th>
                <th className="py-3 px-4">Metadata Parameters</th>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main text-xs font-medium">
              {loading ? (
                [...Array(5)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={5} className="py-4 px-4 h-12 bg-panel" />
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-main">
                    No matching audit logs registered in the system.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSystem = !log.auth_user_id;
                  
                  return (
                    <tr key={log.id} className="hover:bg-background/40 transition-colors">
                      {/* Operator */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isSystem 
                            ? 'text-warning-main bg-warning-main/10' 
                            : 'text-accent bg-accent/10'
                        }`}>
                          {isSystem ? <Server size={10} /> : <User size={10} />}
                          {isSystem ? 'SYSTEM CALLBACK' : (log.metadata?.operator_email || 'Authenticated User')}
                        </span>
                      </td>

                      {/* Action Event */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-text-main tracking-tight uppercase">
                          {log.action}
                        </span>
                      </td>

                      {/* Metadata */}
                      <td className="py-3 px-4 text-muted-main font-mono max-w-xs truncate" title={JSON.stringify(log.metadata)}>
                        {renderDetails(log.metadata)}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-muted-main font-mono">
                        {new Date(log.created_at).toLocaleString('en-KE')}
                      </td>

                      {/* Detail Trigger */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenDetails(log)}
                          className="p-1 hover:bg-background border border-border-main rounded transition-colors text-muted-main hover:text-text-main cursor-pointer"
                          title="View detailed logs parameters"
                        >
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED VIEW MODAL */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            {/* Modal Backdrop animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 cursor-default"
            />

            {/* Modal Card Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-panel border border-border-main rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col z-10"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border-main bg-background/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-wider border border-accent/20 bg-accent/5 rounded px-1.5 py-0.5">
                      LOG #{selectedLog.id.slice(-6)}
                    </span>
                    <span className="text-[10px] font-mono text-muted-main font-semibold">
                      {new Date(selectedLog.created_at).toLocaleTimeString('en-KE')}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-text-main tracking-tight uppercase font-mono mt-1">
                    {selectedLog.action}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 hover:bg-background border border-border-main rounded-lg text-muted-main hover:text-text-main transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                
                {/* Meta details list */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-background/30 border border-border-main p-3.5 rounded-xl">
                  <div>
                    <span className="block text-[9px] font-semibold text-muted-main uppercase tracking-wider">Operator</span>
                    <span className="font-semibold text-text-main font-mono truncate block mt-0.5">
                      {selectedLog.metadata?.operator_email || 'System / Callback'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-semibold text-muted-main uppercase tracking-wider">Created Date</span>
                    <span className="font-semibold text-text-main font-mono block mt-0.5">
                      {new Date(selectedLog.created_at).toLocaleDateString('en-KE')}
                    </span>
                  </div>
                </div>

                {/* Raw Parameters Block */}
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-muted-main uppercase tracking-wider flex items-center gap-1">
                    <Info size={10} />
                    Audit Parameters Metadata
                  </span>
                  <div className="bg-background border border-border-main p-3 rounded-xl max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed text-muted-main">
                    {Object.entries(selectedLog.metadata || {}).map(([key, val]) => (
                      <div key={key} className="py-0.5 border-b border-border-main/20 last:border-b-0">
                        <span className="text-text-main font-bold">{key}:</span>{' '}
                        <span className="text-accent">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Lookup cross-references */}
                {modalDetails.loading ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-main font-medium">
                    <RefreshCw className="animate-spin text-accent" size={16} />
                    <span>Resolving audit parameters ledger...</span>
                  </div>
                ) : (
                  <>
                    {/* Cross-Referenced Transaction */}
                    {modalDetails.matchingTx && (
                      <div className="space-y-1.5">
                        <span className="block text-[9px] font-bold text-muted-main uppercase tracking-wider flex items-center gap-1">
                          <Layers size={10} className="text-success-main" />
                          Ledger Cross Reference
                        </span>
                        <div className="border border-success-main/20 bg-success-main/5 p-3.5 rounded-xl space-y-2 text-xs font-medium">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold bg-background text-text-main border border-border-main rounded px-1.5 py-0.5">
                              {modalDetails.matchingTx.transaction_type}
                            </span>
                            <span className={`text-[10px] font-bold font-mono ${
                              modalDetails.matchingTx.direction === 'IN' ? 'text-success-main' : 'text-danger'
                            }`}>
                              {modalDetails.matchingTx.direction === 'IN' ? '+' : '-'}{formatKES(Number(modalDetails.matchingTx.amount))}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-main">
                            <div>Receipt: <span className="font-bold text-text-main">{modalDetails.matchingTx.mpesa_receipt || '-'}</span></div>
                            <div>Phone: <span className="text-text-main">+{modalDetails.matchingTx.phone_number || '-'}</span></div>
                          </div>
                          <div className="text-[11px] text-muted-main border-t border-border-main/50 pt-1.5">
                            Description: <span className="text-text-main font-medium">{modalDetails.matchingTx.description}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Resulting Balance Snap */}
                    <div className="space-y-1.5">
                      <span className="block text-[9px] font-bold text-muted-main uppercase tracking-wider flex items-center gap-1">
                        <Database size={10} className="text-accent" />
                        Account balance Snapshot (Resulting)
                      </span>
                      <div className="border border-border-main bg-background/50 p-4 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-main">Resulting Balance:</span>
                        <span className="text-lg font-bold font-mono text-accent">
                          {modalDetails.resultingBalance !== null ? formatKES(modalDetails.resultingBalance) : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  </>
                )}

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
