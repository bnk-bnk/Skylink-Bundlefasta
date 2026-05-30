'use client';

import React, { useState, useEffect } from 'react';
import { Send, AlertTriangle, ShieldCheck, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { sendB2cAction } from '@/app/actions';
import { createClient } from '@/lib/supabase/client';
import PinConfirmModal from '../shared/PinConfirmModal';
import { getB2cErrorMessage } from '@/lib/services/darajaErrors';

export default function B2cView() {
  const [phone, setPhone] = useState('254708374149');
  const [amount, setAmount] = useState('100');
  const [remarks, setRemarks] = useState('Salary Payment');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [recentB2c, setRecentB2c] = useState<any[]>([]);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  
  const supabase = createClient();

  const loadB2cRequests = async () => {
    const { data } = await supabase
      .from('b2c_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentB2c(data || []);
  };

  useEffect(() => {
    loadB2cRequests();

    // Subscribe to realtime updates on b2c_requests
    const channel = supabase
      .channel('b2c_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'b2c_requests' },
        () => {
          loadB2cRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPinModalOpen(true);
  };

  const handleConfirmPin = async (pin: string) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await sendB2cAction({
        phone,
        amount: Number(amount),
        remarks,
        pin,
      });

      if (res.success && res.data) {
        setSuccessMsg(`B2C payout request initiated! Conversation ID: ${res.data.conversation_id}`);
        loadB2cRequests();
      } else {
        setErrorMsg(res.error || 'B2C payout dispatch failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error.');
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
          <h3 className="font-bold text-sm">Send B2C Payout</h3>
          <span title="Disburses funds directly from the company's Utility/Working account to the customer's mobile wallet.">
            <HelpCircle size={14} className="text-muted-main cursor-help shrink-0" />
          </span>
        </div>
        <p className="text-[10px] text-muted-main mb-4">
          Requires dashboard security PIN authorization.
        </p>

        <form onSubmit={handlePayoutSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Recipient Phone Number
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background font-mono"
              placeholder="2547XXXXXXXX"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Amount (KES)
            </label>
            <input
              type="number"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background font-mono font-bold"
              placeholder="1000"
              min="10"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Payment Remarks
            </label>
            <input
              type="text"
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background"
              placeholder="Salary Payment, Promotion, Reimbursement"
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
            <Send size={14} />
            {loading ? 'Authorizing Payout...' : 'Send Payout Request'}
          </button>
        </form>
      </div>

      {/* 2. Active List Column */}
      <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-2 flex flex-col">
        <div className="mb-4">
          <h3 className="font-bold text-sm">Recent B2C payout transactions</h3>
          <p className="text-xs text-muted-main">Real-time update of dispatched B2C payouts</p>
        </div>

        <div className="flex-grow overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-main bg-background text-[10px] font-semibold text-muted-main uppercase tracking-wider">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Remarks</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main font-medium">
              {recentB2c.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-main">
                    No B2C payouts logged yet. Use the form to trigger one.
                  </td>
                </tr>
              ) : (
                recentB2c.map((req) => {
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
                        desc: getB2cErrorMessage(resultCode) || resultDesc
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
                      <td className="py-3 px-3 font-mono">{req.phone_number}</td>
                      <td className="py-3 px-3 font-mono font-bold text-danger">
                        KES {Number(req.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 truncate max-w-[150px]">{req.remarks || '-'}</td>
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
        title="Authorize B2C Payout"
        description={`Please enter your dashboard PIN to confirm and authorize the payout of KES ${Number(amount).toFixed(2)} to ${phone}.`}
      />

    </div>
  );
}
