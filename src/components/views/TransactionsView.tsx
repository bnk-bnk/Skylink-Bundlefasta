'use client';

import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, RefreshCcw, ArrowUpRight, ArrowDownLeft, Copy, Check, Download, Trash2, Eye, X, Info, FileText, User, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { getTransactionsAction, getProductSourcesAction, deleteTransactionsAction, getWebhookEventsAction } from '@/app/actions';
import TransactionDetailDrawer from '@/components/shared/TransactionDetailDrawer';
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
              <option value="bingwaone">BingwaOne</option>
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
                          tx.source_system === 'bingwaone'
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
        <TransactionDetailDrawer
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}

    </div>
  );
}
