'use client';

import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, RefreshCcw, ArrowUpRight, ArrowDownLeft, Copy, Check, Download, Trash2, Eye, X, Info, FileText, User, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { getTransactionsAction, getProductSourcesAction, deleteTransactionsAction, getWebhookEventsAction } from '@/app/actions';
import { TransactionDirection, TransactionType, TransactionStatus } from '@/types/database';
import { getReadableLabel } from '@/lib/utils/labels';

export default function TransactionsView() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // View Details Drawer state
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [webhookEvidence, setWebhookEvidence] = useState<any[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showRawPayload, setShowRawPayload] = useState(false);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [datePreset, setDatePreset] = useState<string>('7days');
  const [direction, setDirection] = useState<string>('');
  const [txType, setTxType] = useState<string>('');
  const [sourceId, setSourceId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  
  // Extended Filters
  const [sourceSystem, setSourceSystem] = useState<string>('');
  const [paymentType, setPaymentType] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [productStream, setProductStream] = useState<string>('');
  const [serviceSource, setServiceSource] = useState<string>('');
  const [currency, setCurrency] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [reconStatus, setReconStatus] = useState<string>('');
  
  // Search Filters
  const [receiptSearch, setReceiptSearch] = useState<string>('');
  const [phoneSearch, setPhoneSearch] = useState<string>('');
  const [referenceSearch, setReferenceSearch] = useState<string>('');
  const [agentSearch, setAgentSearch] = useState<string>('');
  const [userIdOrAgentId, setUserIdOrAgentId] = useState<string>('');

  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  // Handle Preset Ranges
  useEffect(() => {
    const now = new Date();
    let start = '';
    let end = '';

    if (datePreset === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start = today.toISOString();
    } else if (datePreset === 'yesterday') {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start = yesterday.toISOString();
      end = today.toISOString();
    } else if (datePreset === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      start = sevenDaysAgo.toISOString();
    } else if (datePreset === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      start = thirtyDaysAgo.toISOString();
    } else if (datePreset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      start = startOfMonth.toISOString();
    }

    if (datePreset !== 'custom') {
      setDateStart(start ? start.split('T')[0] : '');
      setDateEnd(end ? end.split('T')[0] : '');
    }
  }, [datePreset]);

  const loadTransactions = async () => {
    setLoading(true);
    setSelectedIds([]); // Clear selection when reloaded
    try {
      // Build filters payload
      const filterArgs: any = {
        direction: direction ? (direction as TransactionDirection) : undefined,
        transactionType: txType ? (txType as TransactionType) : undefined,
        sourceId: sourceId || undefined,
        status: status ? (status as TransactionStatus) : undefined,
        dateStart: dateStart ? new Date(dateStart).toISOString() : undefined,
        dateEnd: dateEnd ? new Date(dateEnd).toISOString() : undefined,
        sourceSystem: sourceSystem || undefined,
        paymentType: paymentType || undefined,
        module: moduleFilter || undefined,
        productStream: productStream || undefined,
        serviceSource: serviceSource || undefined,
        currency: currency || undefined,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        reconciliationStatus: reconStatus || undefined,
        receiptSearch: receiptSearch || undefined,
        phoneSearch: phoneSearch || undefined,
        accountReference: referenceSearch || undefined,
        agentNameOrUsername: agentSearch || undefined,
        userIdOrAgentId: userIdOrAgentId || undefined,
        limit: 100,
      };

      const { data } = await getTransactionsAction(filterArgs);
      setTransactions(data || []);

      const srcList = await getProductSourcesAction();
      setSources(srcList || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [direction, txType, sourceId, status, sourceSystem, reconStatus, dateStart, dateEnd]);

  // Load raw webhook evidence when a transaction is selected
  useEffect(() => {
    if (selectedTx) {
      setLoadingEvidence(true);
      setShowMetadata(false);
      setShowRawPayload(false);
      getWebhookEventsAction({ transactionId: selectedTx.id })
        .then((data) => {
          setWebhookEvidence(data || []);
        })
        .catch((err) => {
          console.error('[TransactionsView] Failed loading webhook evidence:', err);
        })
        .finally(() => {
          setLoadingEvidence(false);
        });
    }
  }, [selectedTx]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetFilters = () => {
    setDatePreset('7days');
    setDirection('');
    setTxType('');
    setSourceId('');
    setStatus('');
    setSourceSystem('');
    setPaymentType('');
    setModuleFilter('');
    setProductStream('');
    setServiceSource('');
    setCurrency('');
    setMinAmount('');
    setMaxAmount('');
    setReconStatus('');
    setReceiptSearch('');
    setPhoneSearch('');
    setReferenceSearch('');
    setAgentSearch('');
    setUserIdOrAgentId('');
    setDateStart('');
    setDateEnd('');
    setTimeout(loadTransactions, 50);
  };

  // Select Row helpers
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === transactions.length && transactions.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(tx => tx.id));
    }
  };

  // CSV Export respecting filters
  const handleBulkExport = () => {
    const selectedTxs = selectedIds.length > 0
      ? transactions.filter(t => selectedIds.includes(t.id))
      : transactions;

    const headers = ['Source', 'Direction', 'Type', 'Module', 'Service', 'Acc Ref', 'Counterparty', 'Amount', 'Receipt', 'Status', 'Recon Status', 'Date'];
    const rows = selectedTxs.map(t => {
      const counterparty = t.payer_phone || t.recipient_phone || t.counterparty_phone || t.phone_number || '';
      return [
        t.source_system,
        t.direction,
        t.transaction_type,
        t.module || '',
        t.service_source || '',
        t.account_reference || '',
        counterparty,
        t.amount,
        t.receipt || t.mpesa_receipt || '',
        t.status,
        t.reconciliation_status,
        t.occurred_at || t.created_at
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transactions_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected transactions?`)) {
      return;
    }
    setBulkLoading(true);
    try {
      const res = await deleteTransactionsAction(selectedIds);
      if (res.success) {
        alert('Transactions deleted successfully');
        loadTransactions();
      } else {
        alert(`Failed to delete: ${res.error}`);
      }
    } catch (err: any) {
      alert(`An error occurred: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);
  };

  return (
    <div className="space-y-4 font-outfit antialiased">
      
      {/* Search and Filters Bar */}
      <div className="bg-panel border border-border-main rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Source System */}
            <select
              value={sourceSystem}
              onChange={(e) => setSourceSystem(e.target.value)}
              className="text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none font-semibold cursor-pointer"
            >
              <option value="">All Sources</option>
              <option value="bingwazone">BingwaZone</option>
              <option value="pesatrix">Pesatrix</option>
              <option value="manual">Manual</option>
              <option value="unknown">Unknown</option>
            </select>

            {/* Direction */}
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none font-semibold cursor-pointer"
            >
              <option value="">All Directions</option>
              <option value="IN">Incoming (IN)</option>
              <option value="OUT">Outgoing (OUT)</option>
            </select>

            {/* Status */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none font-semibold cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>

            {/* Reconciliation Status */}
            <select
              value={reconStatus}
              onChange={(e) => setReconStatus(e.target.value)}
              className="text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none font-semibold cursor-pointer"
            >
              <option value="">All Recon Statuses</option>
              <option value="matched">Matched</option>
              <option value="app_only">App Only</option>
              <option value="provider_only">Provider Only</option>
              <option value="conflict">Conflict</option>
              <option value="not_applicable">Not Applicable</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 py-2 px-3 border rounded-lg text-xs font-semibold hover:bg-background shrink-0 transition-colors cursor-pointer ${
                showFilters ? 'border-accent text-accent bg-accent/5' : 'border-border-main text-muted-main'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filters
            </button>
            <button
              onClick={loadTransactions}
              className="flex items-center justify-center p-2 border border-border-main text-muted-main hover:text-text-main hover:bg-background rounded-lg transition-colors shrink-0 cursor-pointer"
              title="Refresh"
            >
              <RefreshCcw size={14} />
            </button>
          </div>
        </div>

        {/* Detailed Filters (Collapsible) */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border-main animate-slide-down text-xs">
            {/* Date Preset */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Date Preset</label>
              <select
                value={datePreset}
                onChange={e => setDatePreset(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Range Dates */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Start Date</label>
              <input
                type="date"
                value={dateStart}
                disabled={datePreset !== 'custom'}
                onChange={e => setDateStart(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-muted-main focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">End Date</label>
              <input
                type="date"
                value={dateEnd}
                disabled={datePreset !== 'custom'}
                onChange={e => setDateEnd(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-muted-main focus:outline-none"
              />
            </div>

            {/* Receipt Search */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Receipt Number</label>
              <input
                type="text"
                value={receiptSearch}
                onChange={e => setReceiptSearch(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="e.g. TFA1234567"
              />
            </div>

            {/* Phone Search */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Phone Search</label>
              <input
                type="text"
                value={phoneSearch}
                onChange={e => setPhoneSearch(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="e.g. 2547..."
              />
            </div>

            {/* Account Reference */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Account Reference</label>
              <input
                type="text"
                value={referenceSearch}
                onChange={e => setReferenceSearch(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="e.g. Mini Site"
              />
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Transaction Type</label>
              <select
                value={txType}
                onChange={e => setTxType(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="C2B">C2B</option>
                <option value="STK">STK</option>
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
                <option value="REVERSAL">Reversal</option>
                <option value="activation">Activation</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="wallet_withdrawal">Wallet Withdrawal</option>
              </select>
            </div>

            {/* Module Filter */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Module</label>
              <select
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
              >
                <option value="">All Modules</option>
                <option value="mini_site">Mini Sites</option>
                <option value="whatsapp_bot">WhatsApp Bot</option>
                <option value="whatsapp_agents">WhatsApp Agents</option>
                <option value="whatsapp_auto_post">WhatsApp Auto Post</option>
                <option value="requested_poster">Requested Posters</option>
                <option value="bundle">Bundles</option>
                <option value="wallet">Wallet</option>
                <option value="account_activation">Account Activation</option>
              </select>
            </div>

            {/* Product Stream */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Product Stream</label>
              <input
                type="text"
                value={productStream}
                onChange={e => setProductStream(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="e.g. mini_site"
              />
            </div>

            {/* Service Source */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Service Source</label>
              <input
                type="text"
                value={serviceSource}
                onChange={e => setServiceSource(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="e.g. mini_site_subscription"
              />
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Min Amount (KES)</label>
              <input
                type="number"
                value={minAmount}
                onChange={e => setMinAmount(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Max Amount (KES)</label>
              <input
                type="number"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="10000"
              />
            </div>

            {/* Agent Details */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">Agent Search</label>
              <input
                type="text"
                value={agentSearch}
                onChange={e => setAgentSearch(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="Name, username or business"
              />
            </div>

            {/* User ID / Agent ID */}
            <div>
              <label className="block text-[9px] font-bold text-muted-main uppercase tracking-wider mb-1">User ID / Agent ID</label>
              <input
                type="text"
                value={userIdOrAgentId}
                onChange={e => setUserIdOrAgentId(e.target.value)}
                className="w-full py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="External account ID"
              />
            </div>

            {/* Reset / Search Actions */}
            <div className="col-span-2 md:col-span-2 flex justify-end items-end gap-2 pt-2">
              <button
                onClick={handleResetFilters}
                className="text-xs py-2 px-4 border border-border-main text-muted-main hover:bg-background rounded-lg font-medium cursor-pointer"
              >
                Reset
              </button>
              <button
                onClick={loadTransactions}
                className="text-xs py-2 px-5 bg-text-main text-panel hover:opacity-90 rounded-lg font-semibold cursor-pointer"
              >
                Apply Search
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contextual Bar for Exports & Bulk Updates */}
      <div className="flex justify-between items-center bg-panel border border-border-main rounded-xl p-3 shadow-xs">
        <div className="text-xs font-semibold text-muted-main">
          {selectedIds.length > 0 ? (
            <span className="text-accent">{selectedIds.length} transactions selected</span>
          ) : (
            <span>Showing {transactions.length} records</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBulkExport}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-panel hover:bg-background border border-border-main rounded-lg text-xs font-semibold text-text-main transition-colors cursor-pointer shadow-sm"
          >
            <Download size={14} />
            Export CSV
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} />
              {bulkLoading ? 'Deleting...' : 'Delete Selected'}
            </button>
          )}
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="bg-panel border border-border-main rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-main bg-background text-[10px] font-semibold text-muted-main uppercase tracking-wider">
                <th className="py-3 px-4 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={transactions.length > 0 && selectedIds.length === transactions.length}
                    onChange={handleSelectAll}
                    className="rounded border-border-main accent-accent cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Direction</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Acc Ref</th>
                <th className="py-3 px-4">Counterparty</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Receipt</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main text-xs font-medium">
              {loading ? (
                [...Array(5)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={12} className="py-4 px-4 h-12 bg-panel" />
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-main">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const sourceSystemLabel = getReadableLabel(tx.source_system);
                  const moduleLabel = getReadableLabel(tx.module);
                  const counterparty = tx.payer_phone || tx.recipient_phone || tx.counterparty_phone || tx.phone_number || '-';

                  return (
                    <tr key={tx.id} className={`hover:bg-background/40 transition-colors ${
                      selectedIds.includes(tx.id) ? 'bg-accent/5' : ''
                    }`}>
                      {/* Checkbox */}
                      <td className="py-3 px-4 w-10 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(tx.id)}
                          onChange={() => handleSelectRow(tx.id)}
                          className="rounded border-border-main accent-accent cursor-pointer"
                        />
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          tx.source_system === 'bingwazone'
                            ? 'text-accent bg-accent/10 border border-accent/20'
                            : tx.source_system === 'pesatrix'
                              ? 'text-success-main bg-success-main/10 border border-success-main/20'
                              : tx.source_system === 'manual'
                                ? 'text-warning-main bg-warning-main/10 border border-warning-main/20'
                                : 'text-muted-main bg-background'
                        }`}>
                          {sourceSystemLabel}
                        </span>
                      </td>

                      {/* Direction */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-semibold rounded-md text-[10px] px-1.5 py-0.5 ${
                          tx.direction === 'IN' 
                            ? 'text-success-main bg-success-main/10' 
                            : 'text-danger bg-danger/10'
                        }`}>
                          {tx.direction === 'IN' ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                          {tx.direction === 'IN' ? 'Incoming' : 'Outgoing'}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold text-text-main border border-border-main bg-background rounded px-1.5 py-0.5">
                          {tx.transaction_type}
                        </span>
                      </td>

                      {/* Module */}
                      <td className="py-3 px-4 text-muted-main font-semibold">
                        {moduleLabel || '-'}
                      </td>

                      {/* Account Reference */}
                      <td className="py-3 px-4 font-mono font-bold text-text-main">
                        {tx.account_reference || '-'}
                      </td>

                      {/* Counterparty */}
                      <td className="py-3 px-4 font-mono text-muted-main">
                        {counterparty}
                      </td>

                      {/* Amount */}
                      <td className={`py-3 px-4 text-right font-mono font-bold ${
                        tx.direction === 'IN' ? 'text-success-main' : 'text-danger'
                      }`}>
                        {tx.direction === 'IN' ? '+' : '-'}{formatKES(Number(tx.amount))}
                      </td>

                      {/* Receipt */}
                      <td className="py-3 px-4">
                        {tx.receipt || tx.mpesa_receipt ? (
                          <div className="flex items-center gap-1.5 font-mono text-muted-main">
                            <span className="font-semibold text-text-main">{tx.receipt || tx.mpesa_receipt}</span>
                            <button
                              onClick={() => handleCopy(tx.receipt || tx.mpesa_receipt)}
                              className="p-1 hover:bg-background border border-border-main rounded transition-colors text-muted-main hover:text-text-main cursor-pointer"
                              title="Copy receipt number"
                            >
                              {copiedId === (tx.receipt || tx.mpesa_receipt) ? <Check size={10} className="text-success-main" /> : <Copy size={10} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-main font-mono">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          tx.status === 'SUCCESS' 
                            ? 'text-success-main bg-success-main/10' 
                            : tx.status === 'PENDING' 
                              ? 'text-warning-main bg-warning-main/10' 
                              : 'text-danger bg-danger/10'
                        }`}>
                          {tx.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-muted-main font-mono">
                        {new Date(tx.occurred_at || tx.created_at).toLocaleString('en-KE', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1 hover:bg-background border border-border-main rounded transition-colors text-muted-main hover:text-text-main cursor-pointer"
                          title="View details"
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

      {/* Details Side Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedTx(null)}
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
                  <p className="text-[10px] text-muted-main font-mono mt-0.5">{selectedTx.id}</p>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 hover:bg-background rounded-lg border border-border-main transition-colors text-muted-main hover:text-text-main cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Amount Box */}
              <div className="p-4 bg-background border border-border-main rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">Financial Amount</span>
                  <h2 className={`text-2xl font-bold font-mono ${selectedTx.direction === 'IN' ? 'text-success-main' : 'text-danger'}`}>
                    {selectedTx.direction === 'IN' ? '+' : '-'}{formatKES(Number(selectedTx.amount))}
                  </h2>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                    selectedTx.status === 'SUCCESS' ? 'text-success-main bg-success-main/10 border border-success-main/20' : 'text-danger bg-danger/10 border border-danger/20'
                  }`}>
                    {selectedTx.status}
                  </span>
                  <span className="text-[10px] text-muted-main font-semibold">Currency: {selectedTx.currency || 'KES'}</span>
                </div>
              </div>

              {/* Info Grid: Section 1 Summary */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider">Attr Summary</h4>
                <div className="grid grid-cols-2 gap-3.5 bg-background/50 border border-border-main/50 rounded-xl p-4 text-xs font-semibold">
                  <div>
                    <span className="text-[9px] text-muted-main block">Source System</span>
                    <span className="text-text-main">{getReadableLabel(selectedTx.source_system)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block">Provider / Method</span>
                    <span className="text-text-main">{getReadableLabel(selectedTx.provider) || 'M-Pesa'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block">Inception Origin</span>
                    <span className="text-text-main font-mono text-[11px]">{getReadableLabel(selectedTx.origin)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block">Directionality</span>
                    <span className="text-text-main">{selectedTx.direction === 'IN' ? 'Incoming Payment' : 'Outgoing Payout'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block">Transaction Type</span>
                    <span className="text-text-main">{selectedTx.transaction_type}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block">Payment Stream Type</span>
                    <span className="text-text-main">{getReadableLabel(selectedTx.payment_type) || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block">Module Component</span>
                    <span className="text-text-main">{getReadableLabel(selectedTx.module) || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block">Service Source</span>
                    <span className="text-text-main">{getReadableLabel(selectedTx.service_source) || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Info Grid: Section 2 Payment Details */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider">Payment Metadata</h4>
                <div className="grid grid-cols-2 gap-3.5 bg-background/50 border border-border-main/50 rounded-xl p-4 text-xs font-mono font-bold">
                  <div>
                    <span className="text-[9px] text-muted-main block font-sans">Provider Receipt Code</span>
                    <span className="text-text-main">{selectedTx.receipt || selectedTx.mpesa_receipt || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block font-sans">Account Reference</span>
                    <span className="text-text-main">{selectedTx.account_reference || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block font-sans">Payer Contact</span>
                    <span className="text-text-main">{selectedTx.payer_phone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block font-sans">Recipient Contact</span>
                    <span className="text-text-main">{selectedTx.recipient_phone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block font-sans">External Ref ID</span>
                    <span className="text-text-main text-[11px] truncate block">{selectedTx.external_reference_id || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-main block font-sans">External User ID</span>
                    <span className="text-text-main text-[11px] truncate block">{selectedTx.external_user_id || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Info Grid: Section 3 Agent details */}
              {selectedTx.agent_name && (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider flex items-center gap-1">
                    <User size={12} />
                    Agent Attributions
                  </h4>
                  <div className="grid grid-cols-2 gap-3.5 bg-background/50 border border-border-main/50 rounded-xl p-4 text-xs font-semibold">
                    <div>
                      <span className="text-[9px] text-muted-main block">Agent Name</span>
                      <span className="text-text-main">{selectedTx.agent_name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-main block">Business Name</span>
                      <span className="text-text-main">{selectedTx.agent_business_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-main block">Agent Username</span>
                      <span className="text-text-main font-mono">@{selectedTx.agent_username || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-main block">External Agent ID</span>
                      <span className="text-text-main font-mono text-[11px]">{selectedTx.external_agent_id || '-'}</span>
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
                    <span>{selectedTx.initiated_at ? new Date(selectedTx.initiated_at).toLocaleString('en-KE') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] block font-sans font-bold">Occurred At</span>
                    <span>{selectedTx.occurred_at ? new Date(selectedTx.occurred_at).toLocaleString('en-KE') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] block font-sans font-bold">Completed At</span>
                    <span>{selectedTx.completed_at ? new Date(selectedTx.completed_at).toLocaleString('en-KE') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] block font-sans font-bold">Received (DB Created)</span>
                    <span>{new Date(selectedTx.created_at).toLocaleString('en-KE')}</span>
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
                      selectedTx.reconciliation_status === 'matched'
                        ? 'text-success-main bg-success-main/10 border border-success-main/20'
                        : selectedTx.reconciliation_status === 'conflict'
                          ? 'text-danger bg-danger/10 border border-danger/20'
                          : 'text-warning-main bg-warning-main/10 border border-warning-main/20'
                    }`}>
                      {selectedTx.reconciliation_status?.toUpperCase()}
                    </span>
                  </div>
                  
                  {/* Matching Info */}
                  <div className="space-y-1 bg-background rounded-lg p-2.5 border border-border-main/60">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-main">Payment Evidence:</span>
                      <span className="font-semibold text-text-main">{selectedTx.mpesa_receipt ? 'M-Pesa Callback (Confirmed)' : 'Pending Provider'}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-main">Application Evidence:</span>
                      <span className="font-semibold text-text-main">{selectedTx.source_system !== 'unknown' ? `${getReadableLabel(selectedTx.source_system)} Webhook` : 'No Metadata'}</span>
                    </div>
                  </div>

                  {/* Conflicting information panel */}
                  {selectedTx.reconciliation_status === 'conflict' && (
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
              {selectedTx.metadata && Object.keys(selectedTx.metadata).length > 0 && (
                <div className="border border-border-main rounded-xl overflow-hidden bg-background/30">
                  <button
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-text-main border-none focus:outline-none cursor-pointer"
                  >
                    <span>Transaction Metadata ({Object.keys(selectedTx.metadata).length} keys)</span>
                    {showMetadata ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showMetadata && (
                    <div className="p-4 border-t border-border-main bg-background/50 text-[10px] font-mono leading-relaxed text-muted-main max-h-48 overflow-y-auto font-medium">
                      {JSON.stringify(selectedTx.metadata, null, 2)}
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
      )}

    </div>
  );
}
