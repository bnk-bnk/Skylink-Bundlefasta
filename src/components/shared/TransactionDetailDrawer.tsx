'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  User,
  Info,
  ChevronUp,
  ChevronDown,
  ShieldAlert
} from 'lucide-react';
import { getReadableLabel } from '@/lib/utils/labels';
import { getWebhookEventsAction } from '@/app/actions';

interface TransactionDetailDrawerProps {
  transaction: any;
  onClose: () => void;
}

export default function TransactionDetailDrawer({ transaction, onClose }: TransactionDetailDrawerProps) {
  const [showMetadata, setShowMetadata] = useState(false);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [webhookEvidence, setWebhookEvidence] = useState<any[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    if (transaction) {
      setLoadingEvidence(true);
      setShowMetadata(false);
      setShowRawPayload(false);
      getWebhookEventsAction({ transactionId: transaction.id })
        .then((data) => {
          setWebhookEvidence(data || []);
        })
        .catch((err) => {
          console.error('[TransactionDetailDrawer] Failed loading webhook evidence:', err);
        })
        .finally(() => {
          setLoadingEvidence(false);
        });
    }
  }, [transaction]);

  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);
  };

  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-outfit">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
      />
      {/* Drawer Panel */}
      <div className="relative w-full max-w-xl bg-panel border-l border-border-main p-6 shadow-2xl overflow-y-auto flex flex-col justify-between h-full">
        <div className="space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-main pb-4">
            <div>
              <h3 className="font-bold text-base text-text-main flex items-center gap-1.5">
                <FileText className="text-accent" size={18} />
                Transaction Detail Sheet
              </h3>
              <p className="text-[10px] text-muted-main font-mono mt-0.5">{transaction.id}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-background rounded-lg border border-border-main transition-colors text-muted-main hover:text-text-main cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Amount Box */}
          <div className="p-4 bg-background border border-border-main rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">Financial Amount</span>
              <h2 className={`text-2xl font-bold font-mono ${transaction.direction === 'IN' ? 'text-success-main' : 'text-danger'}`}>
                {transaction.direction === 'IN' ? '+' : '-'}{formatKES(Number(transaction.amount))}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                transaction.status === 'SUCCESS' ? 'text-success-main bg-success-main/10 border border-success-main/20' : 'text-danger bg-danger/10 border border-danger/20'
              }`}>
                {transaction.status}
              </span>
              <span className="text-[10px] text-muted-main font-semibold">Currency: {transaction.currency || 'KES'}</span>
            </div>
          </div>

          {/* Attr Summary */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider">Attr Summary</h4>
            <div className="grid grid-cols-2 gap-3.5 bg-background/50 border border-border-main/50 rounded-xl p-4 text-xs font-semibold">
              <div>
                <span className="text-[9px] text-muted-main block">Source System</span>
                <span className="text-text-main">{getReadableLabel(transaction.source_system)}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block">Provider / Method</span>
                <span className="text-text-main">{getReadableLabel(transaction.provider) || 'M-Pesa'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block">Inception Origin</span>
                <span className="text-text-main font-mono text-[11px]">{getReadableLabel(transaction.origin)}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block">Directionality</span>
                <span className="text-text-main">{transaction.direction === 'IN' ? 'Incoming Payment' : 'Outgoing Payout'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block">Transaction Type</span>
                <span className="text-text-main">{transaction.transaction_type}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block">Payment Stream Type</span>
                <span className="text-text-main">{getReadableLabel(transaction.payment_type) || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block">Module Component</span>
                <span className="text-text-main">{getReadableLabel(transaction.module) || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block">Service Source</span>
                <span className="text-text-main">{getReadableLabel(transaction.service_source) || '-'}</span>
              </div>
            </div>
          </div>

          {/* Payment Metadata */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider">Payment Metadata</h4>
            <div className="grid grid-cols-2 gap-3.5 bg-background/50 border border-border-main/50 rounded-xl p-4 text-xs font-mono font-bold">
              <div>
                <span className="text-[9px] text-muted-main block font-sans">Provider Receipt Code</span>
                <span className="text-text-main">{transaction.receipt || transaction.mpesa_receipt || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block font-sans">Account Reference</span>
                <span className="text-text-main">{transaction.account_reference || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block font-sans">Payer Contact</span>
                <span className="text-text-main">{transaction.payer_phone || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block font-sans">Recipient Contact</span>
                <span className="text-text-main">{transaction.recipient_phone || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block font-sans">External Ref ID</span>
                <span className="text-text-main text-[11px] truncate block">{transaction.external_reference_id || '-'}</span>
              </div>
              <div>
                <span className="text-[9px] text-muted-main block font-sans">External User ID</span>
                <span className="text-text-main text-[11px] truncate block">{transaction.external_user_id || '-'}</span>
              </div>
            </div>
          </div>

          {/* Agent Attributions */}
          {transaction.agent_name && (
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider flex items-center gap-1">
                <User size={12} />
                Agent Attributions
              </h4>
              <div className="grid grid-cols-2 gap-3.5 bg-background/50 border border-border-main/50 rounded-xl p-4 text-xs font-semibold">
                <div>
                  <span className="text-[9px] text-muted-main block">Agent Name</span>
                  <span className="text-text-main">{transaction.agent_name}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-main block">Business Name</span>
                  <span className="text-text-main">{transaction.agent_business_name || '-'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-main block">Agent Username</span>
                  <span className="text-text-main font-mono">@{transaction.agent_username || '-'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-main block">External Agent ID</span>
                  <span className="text-text-main font-mono text-[11px]">{transaction.external_agent_id || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider">Process Timeline</h4>
            <div className="grid grid-cols-2 gap-3.5 bg-background/50 border border-border-main/50 rounded-xl p-4 text-xs font-mono font-medium text-muted-main">
              <div>
                <span className="text-[9px] block font-sans font-bold">Initiated At</span>
                <span>{transaction.initiated_at ? new Date(transaction.initiated_at).toLocaleString('en-KE') : '-'}</span>
              </div>
              <div>
                <span className="text-[9px] block font-sans font-bold">Occurred At</span>
                <span>{transaction.occurred_at ? new Date(transaction.occurred_at).toLocaleString('en-KE') : '-'}</span>
              </div>
              <div>
                <span className="text-[9px] block font-sans font-bold">Completed At</span>
                <span>{transaction.completed_at ? new Date(transaction.completed_at).toLocaleString('en-KE') : '-'}</span>
              </div>
              <div>
                <span className="text-[9px] block font-sans font-bold">Received (DB Created)</span>
                <span>{new Date(transaction.created_at).toLocaleString('en-KE')}</span>
              </div>
            </div>
          </div>

          {/* Reconciliation Status */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider flex items-center gap-1">
              <Info size={12} />
              Reconciliation Audit Trail
            </h4>
            <div className="bg-background/40 border border-border-main rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-border-main/40 pb-2">
                <span className="font-medium text-text-main">Reconciliation Status</span>
                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded ${
                  transaction.reconciliation_status === 'matched'
                    ? 'text-success-main bg-success-main/10 border border-success-main/20'
                    : transaction.reconciliation_status === 'conflict'
                      ? 'text-danger bg-danger/10 border border-danger/20'
                      : 'text-warning-main bg-warning-main/10 border border-warning-main/20'
                }`}>
                  {transaction.reconciliation_status?.toUpperCase() || 'UNRECONCILED'}
                </span>
              </div>
              
              <div className="space-y-1 bg-background rounded-lg p-2.5 border border-border-main/60">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-main">Payment Evidence:</span>
                  <span className="font-semibold text-text-main">{transaction.mpesa_receipt ? 'M-Pesa Callback (Confirmed)' : 'Pending Provider'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-main">Application Evidence:</span>
                  <span className="font-semibold text-text-main">{transaction.source_system !== 'unknown' ? `${getReadableLabel(transaction.source_system)} Webhook` : 'No Metadata'}</span>
                </div>
              </div>

              {transaction.reconciliation_status === 'conflict' && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-[11px] font-medium flex gap-2">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <strong>Attribution Conflict!</strong>
                    <p className="mt-0.5 leading-relaxed text-[10px] text-danger/80">Multiple applications attempted to enrich this transaction receipt. Review the raw webhook logs below for analysis.</p>
                  </div>
                </div>
              )}

              {/* Webhook events list */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-main block">Linked Ingest Webhook Events</span>
                {loadingEvidence ? (
                  <span className="text-[10px] text-muted-main italic">Loading evidence events...</span>
                ) : webhookEvidence.length === 0 ? (
                  <span className="text-[10px] text-muted-main italic">No linked webhook event logs found.</span>
                ) : (
                  <div className="space-y-1.5 font-mono text-[10px] leading-relaxed max-h-24 overflow-y-auto">
                    {webhookEvidence.map((evt: any) => (
                      <div key={evt.id} className="flex justify-between bg-background p-1.5 rounded border border-border-main/50">
                        <span className="font-bold text-text-main">{evt.event_key}</span>
                        <span className="text-muted-main">{evt.processing_status.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata JSON */}
          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
            <div className="border border-border-main rounded-xl overflow-hidden bg-background/30">
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-text-main border-none focus:outline-none cursor-pointer"
              >
                <span>Transaction Metadata ({Object.keys(transaction.metadata).length} keys)</span>
                {showMetadata ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showMetadata && (
                <div className="p-4 border-t border-border-main bg-background/50 text-[10px] font-mono leading-relaxed text-muted-main max-h-48 overflow-y-auto font-medium">
                  {JSON.stringify(transaction.metadata, null, 2)}
                </div>
              )}
            </div>
          )}

          {/* Raw Ingestion payload collapsible JSON viewer */}
          {webhookEvidence.length > 0 && (
            <div className="border border-border-main rounded-xl overflow-hidden bg-background/30">
              <button
                onClick={() => setShowRawPayload(!showRawPayload)}
                className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-text-main border-none focus:outline-none cursor-pointer"
              >
                <span className="flex items-center gap-1">
                  Raw Webhook Evidence Payload (Ingest Audit)
                </span>
                {showRawPayload ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showRawPayload && (
                <div className="p-4 border-t border-border-main bg-background/50 text-[10px] font-mono leading-relaxed text-muted-main max-h-64 overflow-y-auto font-medium space-y-4">
                  {webhookEvidence.map((evt, idx) => (
                    <div key={evt.id} className="space-y-1.5">
                      <div className="flex justify-between border-b border-border-main/50 pb-1 text-[9px]">
                        <span className="font-bold text-accent">{evt.event_key}</span>
                        <span>Received: {new Date(evt.received_at).toLocaleString('en-KE')}</span>
                      </div>
                      <pre className="p-2 bg-background border border-border-main/60 rounded-lg overflow-x-auto whitespace-pre leading-relaxed">
                        {JSON.stringify(evt.raw_payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
