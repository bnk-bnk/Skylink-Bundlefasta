'use client';

import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, RefreshCcw, ArrowUpRight, ArrowDownLeft, Copy, Check, Download, Trash2 } from 'lucide-react';
import { getTransactionsAction, getProductSourcesAction, deleteTransactionsAction } from '@/app/actions';
import { TransactionDirection, TransactionType, TransactionStatus } from '@/types/database';

export default function TransactionsView() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [direction, setDirection] = useState<string>('');
  const [txType, setTxType] = useState<string>('');
  const [sourceId, setSourceId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  const loadTransactions = async () => {
    setLoading(true);
    setSelectedIds([]); // Clear selection when reloaded
    try {
      const { data } = await getTransactionsAction({
        direction: direction ? (direction as TransactionDirection) : undefined,
        transactionType: txType ? (txType as TransactionType) : undefined,
        sourceId: sourceId || undefined,
        phoneNumber: phone || undefined,
        accountReference: reference || undefined,
        status: status ? (status as TransactionStatus) : undefined,
        dateStart: dateStart ? new Date(dateStart).toISOString() : undefined,
        dateEnd: dateEnd ? new Date(dateEnd).toISOString() : undefined,
        limit: 100,
      });
      setTransactions(data);

      const srcList = await getProductSourcesAction();
      setSources(srcList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [direction, txType, sourceId, status]); // Load immediately on dropdown changes

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetFilters = () => {
    setDirection('');
    setTxType('');
    setSourceId('');
    setPhone('');
    setReference('');
    setStatus('');
    setDateStart('');
    setDateEnd('');
    // Wait for state updates then load
    setTimeout(loadTransactions, 50);
  };

  // Select Row helper
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Select All helper
  const handleSelectAll = () => {
    if (selectedIds.length === transactions.length && transactions.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(tx => tx.id));
    }
  };

  // Bulk Export helper (CSV)
  const handleBulkExport = () => {
    const selectedTxs = transactions.filter(t => selectedIds.includes(t.id));
    const headers = ['Direction', 'Type', 'Product Stream', 'Acc Ref', 'Phone', 'Amount', 'Receipt', 'Status', 'Date'];
    const rows = selectedTxs.map(t => [
      t.direction,
      t.transaction_type,
      t.product_sources?.name || (t.transaction_type === 'STK' ? 'System' : 'Unknown'),
      t.account_reference || '',
      t.phone_number || '',
      t.amount,
      t.mpesa_receipt || '',
      t.status,
      t.created_at
    ]);
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

  // Bulk Delete helper
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
        alert(`Failed to delete transactions: ${res.error}`);
      }
    } catch (err: any) {
      alert(`An error occurred: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // Format currency
  const formatKES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val);
  };

  return (
    <div className="space-y-4 font-outfit antialiased">
      
      {/* Search and Filters Bar */}
      <div className="bg-panel border border-border-main rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Quick Filters */}
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
            >
              <option value="">All Directions</option>
              <option value="IN">IN (Incoming)</option>
              <option value="OUT">OUT (Outgoing)</option>
            </select>

            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value)}
              className="text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="C2B">C2B PayBall</option>
              <option value="STK">STK Push</option>
              <option value="B2C">B2C Payout</option>
              <option value="REVERSAL">Reversal</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>

            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
            >
              <option value="">All Product Streams</option>
              {sources.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.name}
                </option>
              ))}
              <option value="null">Unknown Reference</option>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border-main animate-slide-down">
            <div>
              <label className="block text-[10px] font-semibold text-muted-main uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="2547..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-main uppercase tracking-wider mb-1">
                Account Reference
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-text-main focus:outline-none"
                placeholder="PESATRIX"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-main uppercase tracking-wider mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-muted-main focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-main uppercase tracking-wider mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-border-main rounded-lg bg-background text-muted-main focus:outline-none"
              />
            </div>

            <div className="col-span-2 md:col-span-4 flex justify-end gap-2 mt-2">
              <button
                onClick={handleResetFilters}
                className="text-xs py-1.5 px-3 border border-border-main text-muted-main hover:bg-background rounded-lg font-medium cursor-pointer"
              >
                Reset
              </button>
              <button
                onClick={loadTransactions}
                className="text-xs py-1.5 px-4 bg-text-main text-panel hover:opacity-90 rounded-lg font-semibold cursor-pointer"
              >
                Apply Search
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions Contextual Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center justify-between animate-fade-in">
          <div className="text-xs font-semibold text-accent">
            {selectedIds.length} transaction{selectedIds.length > 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkExport}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-panel hover:bg-background border border-border-main rounded-lg text-xs font-medium text-text-main transition-colors cursor-pointer shadow-sm"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} />
              {bulkLoading ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        </div>
      )}

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
                <th className="py-3 px-4">Dir</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Product Stream</th>
                <th className="py-3 px-4">Acc Ref</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Receipt</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main text-xs font-medium">
              {loading ? (
                [...Array(5)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={10} className="py-4 px-4 h-12 bg-panel" />
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-main">
                    No transactions match the selected filters. Use the Operations triggers to execute.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const sourceName = tx.product_sources?.name || (tx.transaction_type === 'STK' ? 'System' : 'Unknown');

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

                      {/* Direction */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-semibold rounded-md text-[10px] px-1.5 py-0.5 ${
                          tx.direction === 'IN' 
                            ? 'text-success-main bg-success-main/10' 
                            : 'text-danger bg-danger/10'
                        }`}>
                          {tx.direction === 'IN' ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                          {tx.direction}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold text-text-main border border-border-main bg-background rounded px-1.5 py-0.5">
                          {tx.transaction_type}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          sourceName === 'Unknown' 
                            ? 'text-muted-main bg-background' 
                            : 'text-accent bg-accent/10'
                        }`}>
                          {sourceName}
                        </span>
                      </td>

                      {/* Account Reference */}
                      <td className="py-3 px-4 font-mono font-bold text-text-main">
                        {tx.account_reference || '-'}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono text-muted-main">
                        {tx.phone_number || '-'}
                      </td>

                      {/* Amount */}
                      <td className={`py-3 px-4 text-right font-mono font-bold ${
                        tx.direction === 'IN' ? 'text-success-main' : 'text-danger'
                      }`}>
                        {tx.direction === 'IN' ? '+' : '-'}{formatKES(Number(tx.amount))}
                      </td>

                      {/* Receipt */}
                      <td className="py-3 px-4">
                        {tx.mpesa_receipt ? (
                          <div className="flex items-center gap-1.5 font-mono text-muted-main">
                            <span className="font-semibold text-text-main">{tx.mpesa_receipt}</span>
                            <button
                              onClick={() => handleCopy(tx.mpesa_receipt)}
                              className="p-1 hover:bg-background border border-border-main rounded transition-colors text-muted-main hover:text-text-main cursor-pointer"
                              title="Copy receipt number"
                            >
                              {copiedId === tx.mpesa_receipt ? <Check size={10} className="text-success-main" /> : <Copy size={10} />}
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
                        {new Date(tx.created_at).toLocaleString('en-KE', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
