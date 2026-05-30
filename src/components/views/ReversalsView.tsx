'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { requestReversalAction } from '@/app/actions';
import { createClient } from '@/lib/supabase/client';
import PinConfirmModal from '../shared/PinConfirmModal';
import { getReversalErrorMessage } from '@/lib/services/darajaErrors';

export default function ReversalsView() {
  const [receipt, setReceipt] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Payment to wrong business account');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [recentReversals, setRecentReversals] = useState<any[]>([]);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const supabase = createClient();

  const loadReversals = async () => {
    const { data } = await supabase
      .from('reversal_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentReversals(data || []);
  };

  useEffect(() => {
    loadReversals();

    // Subscribe to realtime updates on reversal_requests
    const channel = supabase
      .channel('reversal_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reversal_requests' },
        () => {
          loadReversals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleReversalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPinModalOpen(true);
  };

  const handleConfirmPin = async (pin: string) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await requestReversalAction({
        receipt,
        amount: amount ? Number(amount) : 0, // 0 handles full reversal automatically on M-Pesa
        reason,
        pin,
      });

      if (res.success && res.data) {
        setSuccessMsg(`Reversal request sent successfully! Conversation ID: ${res.data.conversation_id}`);
        setReceipt('');
        setAmount('');
        loadReversals();
      } else {
        setErrorMsg(res.error || 'Failed to dispatch reversal request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. Form Column */}
      <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-1 h-fit">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={18} className="text-warning-main shrink-0" />
          <h3 className="font-bold text-sm">Request Transaction Reversal</h3>
        </div>
        <p className="text-[10px] text-muted-main mb-4">
          Strictly requires dashboard security PIN verification.
        </p>

        <form onSubmit={handleReversalSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Original M-Pesa Receipt
            </label>
            <input
              type="text"
              required
              value={receipt}
              onChange={(e) => setReceipt(e.target.value.toUpperCase().trim())}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background font-mono font-bold"
              placeholder="NLX1293KD9"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Reversal Amount (KES)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background font-mono"
              placeholder="Leave empty for full amount"
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Reason for Reversal
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background"
              placeholder="Payment to wrong account number"
            />
          </div>

          {successMsg && (
            <div className="flex items-start gap-2 p-3 bg-success-main/10 text-success-main border border-success-main/20 rounded-lg text-xs font-medium">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-danger/10 text-danger border border-danger/20 rounded-lg text-xs font-medium">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-text-main text-panel hover:opacity-90 disabled:opacity-50 font-semibold text-xs rounded-lg shadow-sm transition-all active:scale-[0.98]"
          >
            <RotateCcw size={14} />
            {loading ? 'Authorizing Reversal...' : 'Submit Reversal Request'}
          </button>
        </form>
      </div>

      {/* 2. Active List Column */}
      <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-2 flex flex-col">
        <div className="mb-4">
          <h3 className="font-bold text-sm">Recent Reversal Requests</h3>
          <p className="text-xs text-muted-main">Real-time update of Daraja reversal callbacks</p>
        </div>

        <div className="flex-grow overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-main bg-background text-[10px] font-semibold text-muted-main uppercase tracking-wider">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Receipt Number</th>
                <th className="py-2.5 px-3">Reversed Amount</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main font-medium">
              {recentReversals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-main">
                    No reversal requests logged yet. Use the form to submit one.
                  </td>
                </tr>
              ) : (
                recentReversals.map((req) => {
                  const getFailureDetails = () => {
                    if (req.status !== 'FAILED') return null;
                    const payload = req.response_payload;
                    const resultCode = payload?.Result?.ResultCode;
                    const resultDesc = payload?.Result?.ResultDesc;
                    const errorCode = payload?.errorCode;
                    const errorMessage = payload?.errorMessage;

                    if (resultCode !== undefined && resultCode !== null) {
                      return {
                        code: String(resultCode),
                        desc: getReversalErrorMessage(resultCode) || resultDesc
                      };
                    }
                    if (errorCode) {
                      return {
                        code: errorCode,
                        desc: errorMessage || 'API request rejected.'
                      };
                    }
                    return null;
                  };

                  const failDetails = getFailureDetails();

                  return (
                    <tr key={req.id} className="hover:bg-background/30 transition-colors">
                      <td className="py-3 px-3 text-muted-main font-mono">
                        {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-text-main">{req.receipt_number}</td>
                      <td className="py-3 px-3 font-mono">
                        {req.amount ? `KES ${Number(req.amount).toFixed(2)}` : 'Full Original'}
                      </td>
                      <td className="py-3 px-3 truncate max-w-[150px]">{req.reason || '-'}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          req.status === 'SUCCESS'
                            ? 'text-success-main bg-success-main/10'
                            : req.status === 'PENDING'
                              ? 'text-warning-main bg-warning-main/10'
                              : 'text-danger bg-danger/10'
                        }`}>
                          {req.status}
                        </span>
                        {failDetails && (
                          <div className="text-[9px] text-danger/80 mt-1 max-w-[150px] leading-tight font-medium" title={failDetails.desc}>
                            Code {failDetails.code}: {failDetails.desc}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security PIN Authorization Modal */}
      <PinConfirmModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onConfirm={handleConfirmPin}
        title="Authorize Reversal Request"
        description={`Please enter your dashboard PIN to confirm and authorize the reversal of transaction ${receipt}.`}
      />

    </div>
  );
}
