'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Search, Filter, RefreshCw, AlertCircle, CheckCircle2, Clock, Eye, X, MessageSquare, Send, Calendar } from 'lucide-react';
import { getNotificationDeliveriesAction, getSmsSettingsAction } from '@/app/actions';
import { createClient } from '@/lib/supabase/client';
import { getReadableLabel } from '@/lib/utils/labels';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRecipient, setSearchRecipient] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [activeChannel, setActiveChannel] = useState<string>('SMS');

  const supabase = createClient();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotificationDeliveriesAction({
        recipient: searchRecipient || undefined,
        status: statusFilter || undefined,
        channel: channelFilter || undefined,
        direction: directionFilter || undefined,
        sourceSystem: sourceFilter || undefined,
        limit: 100
      });
      setNotifications(data || []);

      // Fetch settings to know what channel is active
      const settings = await getSmsSettingsAction();
      if (settings?.notification_channel) {
        setActiveChannel(settings.notification_channel.toUpperCase());
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Subscribe to realtime updates on notification_deliveries
    const channel = supabase
      .channel('notification_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_deliveries' },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, searchRecipient, statusFilter, channelFilter, directionFilter, sourceFilter]);

  return (
    <div className="space-y-6 font-outfit antialiased">
      
      {/* 1. Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <Mail className="text-accent" size={22} />
            Unified Notification Logs
          </h2>
          <p className="text-xs text-muted-main">
            Audit trail of outbound alert notifications. Active channel: <strong className="text-accent">{activeChannel}</strong>
          </p>
        </div>
        
        <button
          onClick={loadNotifications}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 border border-border-main hover:bg-panel rounded-lg text-xs font-semibold text-muted-main hover:text-text-main transition-colors cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-panel border border-border-main rounded-xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Recipient Search */}
          <div className="flex items-center gap-2 bg-background border border-border-main rounded-lg px-2.5 py-1.5 col-span-1 sm:col-span-2 md:col-span-1">
            <Search size={14} className="text-muted-main" />
            <input
              type="text"
              value={searchRecipient}
              onChange={(e) => setSearchRecipient(e.target.value)}
              placeholder="Search recipient phone..."
              className="bg-transparent border-none text-xs text-text-main focus:outline-none w-full font-semibold"
            />
          </div>

          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-background border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
          >
            <option value="">All Channels</option>
            <option value="sms">SMS Only</option>
            <option value="whatsapp">WhatsApp Only</option>
          </select>

          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="bg-background border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
          >
            <option value="">All Events</option>
            <option value="incoming">Incoming Alerts</option>
            <option value="outgoing">Outgoing Alerts</option>
          </select>

          {/* Source System Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-background border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
          >
            <option value="">All Sources</option>
            <option value="bingwaone">BingwaOne</option>
            <option value="pesatrix">Pesatrix</option>
            <option value="manual">Manual</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
          </select>

        </div>
      </div>

      {/* 3. Logs Table */}
      <div className="bg-panel border border-border-main rounded-xl p-5 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-main bg-background text-[10px] font-semibold text-muted-main uppercase tracking-wider">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3">Message Snippet</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main font-medium">
              {loading && notifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-main">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin text-accent" size={16} />
                      <span>Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-main">
                    No notification deliveries matched the filters.
                  </td>
                </tr>
              ) : (
                notifications.map((log) => (
                  <tr key={log.id} className="hover:bg-background/30 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-3 text-muted-main font-mono whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    
                    {/* Channel */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                        log.channel === 'whatsapp'
                          ? 'text-success-main bg-success-main/10 border border-success-main/20'
                          : 'text-info bg-info/10 border border-info/20'
                      }`}>
                        {log.channel === 'whatsapp' ? <MessageSquare size={10} /> : <Send size={10} />}
                        {log.channel.toUpperCase()}
                      </span>
                    </td>

                    {/* Direction */}
                    <td className="py-3 px-3 font-semibold text-[10px] text-text-main uppercase">
                      {log.notification_type === 'incoming_alert' ? 'INCOMING' : log.notification_type === 'outgoing_alert' ? 'OUTGOING' : 'LEGACY'}
                    </td>

                    {/* Recipient */}
                    <td className="py-3 px-3 font-mono font-bold text-text-main">{log.recipient}</td>
                    
                    {/* Message Snippet */}
                    <td className="py-3 px-3 max-w-xs truncate text-muted-main leading-relaxed">
                      {log.message}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                        log.status === 'SENT'
                          ? 'text-success-main bg-success-main/10'
                          : log.status === 'PENDING'
                            ? 'text-warning-main bg-warning-main/10'
                            : 'text-danger bg-danger/10'
                      }`}>
                        {log.status === 'SENT' && <CheckCircle2 size={10} />}
                        {log.status === 'PENDING' && <Clock size={10} className="animate-pulse" />}
                        {log.status === 'FAILED' && <AlertCircle size={10} />}
                        {log.status}
                      </span>
                    </td>

                    {/* View Details Action */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 hover:bg-background border border-border-main rounded transition-colors text-muted-main hover:text-text-main cursor-pointer"
                        title="View details"
                      >
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Details Drawer / Overlay */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            />
            {/* Drawer Body */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="relative w-full max-w-lg bg-panel border-l border-border-main p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                
                {/* Drawer Header */}
                <div className="flex items-center justify-between border-b border-border-main pb-4">
                  <div>
                    <h3 className="font-bold text-base text-text-main flex items-center gap-1.5">
                      <Mail className="text-accent" size={18} />
                      Notification Log Details
                    </h3>
                    <p className="text-[10px] text-muted-main font-mono mt-0.5">{selectedLog.id}</p>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 hover:bg-background rounded-lg border border-border-main transition-colors text-muted-main hover:text-text-main cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Status Badges Row */}
                <div className="flex gap-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                    selectedLog.status === 'SENT'
                      ? 'text-success-main bg-success-main/10 border border-success-main/20'
                      : 'text-danger bg-danger/10 border border-danger/20'
                  }`}>
                    {selectedLog.status === 'SENT' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                    {selectedLog.status}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded text-info bg-info/10 border border-info/20 uppercase">
                    {selectedLog.channel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded text-text-main bg-background border border-border-main uppercase">
                    Attempts: {selectedLog.attempt_count}
                  </span>
                </div>

                {/* Main Message Body */}
                <div className="bg-background border border-border-main rounded-xl p-4 space-y-2.5">
                  <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider">Message Content</h4>
                  <pre className="text-xs text-text-main leading-relaxed font-sans whitespace-pre-wrap font-semibold">
                    {selectedLog.message}
                  </pre>
                </div>

                {/* Delivery Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/40 border border-border-main/50 rounded-xl p-3.5 space-y-1">
                    <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">Recipient</span>
                    <span className="text-xs font-mono font-bold text-text-main">{selectedLog.recipient}</span>
                  </div>
                  <div className="bg-background/40 border border-border-main/50 rounded-xl p-3.5 space-y-1">
                    <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">Date Queued</span>
                    <span className="text-xs font-mono text-muted-main font-semibold">
                      {new Date(selectedLog.created_at).toLocaleString('en-KE')}
                    </span>
                  </div>
                  <div className="bg-background/40 border border-border-main/50 rounded-xl p-3.5 space-y-1 col-span-2">
                    <span className="text-[9px] font-bold text-muted-main uppercase tracking-wider block">Provider Message ID</span>
                    <span className="text-xs font-mono text-text-main font-bold truncate block">
                      {selectedLog.provider_message_id || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Linkages */}
                <div className="bg-background/30 border border-border-main rounded-xl p-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider">System Linkages</h4>
                  
                  {/* Transaction Linkage */}
                  <div className="flex items-center justify-between border-b border-border-main/40 pb-2">
                    <div>
                      <span className="text-[10px] font-medium text-text-main block">Related Transaction</span>
                      {selectedLog.transactions ? (
                        <span className="text-[10px] font-mono text-accent font-bold">
                          {getReadableLabel(selectedLog.transactions.source_system)} - {selectedLog.transactions.mpesa_receipt || 'Receipt N/A'} (KES {selectedLog.transactions.amount})
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-main italic">None</span>
                      )}
                    </div>
                  </div>

                  {/* Webhook Event Linkage */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10px] font-medium text-text-main block">Reconciled Webhook Event</span>
                      {selectedLog.webhook_events ? (
                        <span className="text-[10px] font-mono text-muted-main font-semibold truncate block max-w-xs">
                          {selectedLog.webhook_events.event_key} ({selectedLog.webhook_events.processing_status})
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-main italic">None</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {selectedLog.error_message && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-semibold flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="block font-bold">Error Message</span>
                      <p className="leading-relaxed font-mono text-[10px]">{selectedLog.error_message}</p>
                    </div>
                  </div>
                )}

                {/* Provider JSON Response */}
                {selectedLog.provider_response && (
                  <div className="bg-background border border-border-main rounded-xl p-4 space-y-2.5">
                    <h4 className="text-[10px] font-bold text-muted-main uppercase tracking-wider">Raw Provider Response</h4>
                    <pre className="text-[10px] text-muted-main font-mono overflow-x-auto p-2 bg-background border border-border-main/60 rounded-lg max-h-48 leading-relaxed whitespace-pre font-medium">
                      {JSON.stringify(selectedLog.provider_response, null, 2)}
                    </pre>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
