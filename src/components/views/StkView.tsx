'use client';

import React, { useState, useEffect } from 'react';
import { Send, Search, HelpCircle, ArrowUpRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { initiateStkPushAction, queryStkStatusAction } from '@/app/actions';
import { createClient } from '@/lib/supabase/client';
import PinConfirmModal from '../shared/PinConfirmModal';

export default function StkView() {
  const [phone, setPhone] = useState('254708374149');
  const [amount, setAmount] = useState('100');
  const [reference, setReference] = useState('PESATRIX');
  const [description, setDescription] = useState('Service Payment');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [pollingStatus, setPollingStatus] = useState<{ [id: string]: string }>({});
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  
  const supabase = createClient();

  const loadActiveRequests = async () => {
    const { data } = await supabase
      .from('stk_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setActiveRequests(data || []);
  };

  useEffect(() => {
    loadActiveRequests();

    // Subscribe to realtime updates on stk_requests
    const channel = supabase
      .channel('stk_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stk_requests' },
        () => {
          loadActiveRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleStkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPinModalOpen(true);
  };

  const handleConfirmPin = async (pin: string) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await initiateStkPushAction({
        phone,
        amount: Number(amount),
        reference,
        description,
        pin,
      });

      if (res.success && res.data) {
        setSuccessMsg(`STK Push initiated successfully! Request ID: ${res.data.checkout_request_id}`);
        loadActiveRequests();
      } else {
        setErrorMsg(res.error || 'Failed to dispatch STK Push request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failure.');
    } finally {
      setLoading(false);
    }
  };

  const handleQueryStatus = async (checkoutId: string) => {
    setPollingStatus(prev => ({ ...prev, [checkoutId]: 'Querying...' }));
    try {
      const res = await queryStkStatusAction(checkoutId);
      if (res.success) {
        setPollingStatus(prev => ({ ...prev, [checkoutId]: res.status }));
      } else {
        setPollingStatus(prev => ({ ...prev, [checkoutId]: 'Query failed' }));
      }
    } catch (err: any) {
      setPollingStatus(prev => ({ ...prev, [checkoutId]: 'Error' }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. Form Column */}
      <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-1 h-fit">
        <div className="flex items-center gap-2 mb-2">
          <span title="Triggers an M-Pesa STK Push payment prompt directly to the customer's phone to input their PIN.">
            <HelpCircle size={16} className="text-accent cursor-help shrink-0" />
          </span>
          <h3 className="font-bold text-sm">Request STK Push</h3>
        </div>
        <p className="text-[10px] text-muted-main mb-4">
          Lipa Na M-Pesa online checkout triggers prompt on phone.
        </p>
        
        <form onSubmit={handleStkSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Customer Phone Number
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background"
              placeholder="2547XXXXXXXX or 07XXXXXXXX"
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
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background"
              placeholder="100"
              min="1"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Account Reference
            </label>
            <input
              type="text"
              required
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase().trim())}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background font-mono font-bold"
              placeholder="e.g. PESATRIX, BINGWAONE, CUSTOM"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Description
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background"
              placeholder="Payment description"
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
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-sm transition-all active:scale-[0.98]"
          >
            <Send size={14} />
            {loading ? 'Processing...' : 'Initiate STK Payment'}
          </button>
        </form>
      </div>

      {/* 2. Active List Column */}
      <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm lg:col-span-2 flex flex-col">
        <div className="mb-4">
          <h3 className="font-bold text-sm">Recent STK Push Requests</h3>
          <p className="text-xs text-muted-main">Real-time STK attempts and query actions</p>
        </div>

        <div className="flex-grow overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-main bg-background text-[10px] font-semibold text-muted-main uppercase tracking-wider">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Ref</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main font-medium">
              {activeRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-main">
                    No STK requests initiated yet. Use the form to test.
                  </td>
                </tr>
              ) : (
                activeRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-background/30 transition-colors">
                    <td className="py-3 px-3 text-muted-main font-mono">
                      {new Date(req.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3 font-mono">{req.phone_number}</td>
                    <td className="py-3 px-3 uppercase">{req.account_reference || '-'}</td>
                    <td className="py-3 px-3 font-mono font-bold text-text-main">
                      KES {Number(req.amount).toFixed(2)}
                    </td>
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
                    </td>
                    <td className="py-3 px-3 text-right">
                      {req.status === 'PENDING' && req.checkout_request_id && (
                        <div className="flex justify-end items-center gap-2">
                          {pollingStatus[req.checkout_request_id] && (
                            <span className="text-[10px] text-accent font-semibold">
                              {pollingStatus[req.checkout_request_id]}
                            </span>
                          )}
                          <button
                            onClick={() => handleQueryStatus(req.checkout_request_id)}
                            className="py-1 px-2 border border-border-main text-[10px] hover:bg-background rounded font-semibold text-text-main transition-colors shrink-0"
                          >
                            Query API
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
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
        title="Authorize STK Push Payment"
        description={`Please enter your dashboard PIN to authorize Lipa Na M-Pesa STK prompt of KES ${Number(amount).toFixed(2)} to ${phone}.`}
      />

    </div>
  );
}
