'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Search, Filter, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { getSmsNotificationsAction } from '@/app/actions';
import { createClient } from '@/lib/supabase/client';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const supabase = createClient();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await getSmsNotificationsAction({
        phone: searchPhone,
        status: statusFilter,
        limit: 50
      });
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to load SMS notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Subscribe to realtime updates on sms_notifications
    const channel = supabase
      .channel('sms_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sms_notifications' },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, searchPhone, statusFilter]);

  return (
    <div className="space-y-6 font-outfit antialiased">
      
      {/* 1. Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <Mail className="text-accent" size={22} />
            SMS Notification Logs
          </h2>
          <p className="text-xs text-muted-main">Audit trail of outbound administrator alert notifications</p>
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
      <div className="bg-panel border border-border-main rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        
        {/* Phone Search */}
        <div className="flex items-center gap-2 bg-background border border-border-main rounded-lg px-2.5 py-1.5 flex-1 max-w-md">
          <Search size={14} className="text-muted-main" />
          <input
            type="text"
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            placeholder="Search phone number..."
            className="bg-transparent border-none text-xs text-text-main focus:outline-none w-full font-semibold"
          />
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2 bg-background border border-border-main rounded-lg px-2.5 py-1.5">
          <Filter size={14} className="text-muted-main" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent border-none text-xs text-text-main focus:outline-none font-semibold cursor-pointer"
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
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Message</th>
                <th className="py-2.5 px-3">Message ID</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Error / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main font-medium">
              {loading && notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-main">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin text-accent" size={16} />
                      <span>Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-main">
                    No SMS notifications matched the selected filters.
                  </td>
                </tr>
              ) : (
                notifications.map((sms) => (
                  <tr key={sms.id} className="hover:bg-background/30 transition-colors">
                    <td className="py-3 px-3 text-muted-main font-mono whitespace-nowrap">
                      {new Date(sms.created_at).toLocaleDateString()} {new Date(sms.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold">{sms.phone}</td>
                    <td className="py-3 px-3 min-w-[200px] max-w-sm whitespace-pre-wrap leading-relaxed">
                      {sms.message}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-muted-main">
                      {sms.message_id || '-'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                        sms.status === 'SENT'
                          ? 'text-success-main bg-success-main/10'
                          : sms.status === 'PENDING'
                            ? 'text-warning-main bg-warning-main/10'
                            : 'text-danger bg-danger/10'
                      }`}>
                        {sms.status === 'SENT' && <CheckCircle2 size={10} />}
                        {sms.status === 'PENDING' && <Clock size={10} className="animate-pulse" />}
                        {sms.status === 'FAILED' && <AlertCircle size={10} />}
                        {sms.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-[200px] truncate text-[10px]">
                      {sms.error_message ? (
                        <span className="text-danger font-medium" title={sms.error_message}>
                          {sms.error_message}
                        </span>
                      ) : sms.provider_response ? (
                        <span className="text-muted-main font-mono" title={JSON.stringify(sms.provider_response)}>
                          {sms.provider_response['response-description'] || 'Success response received'}
                        </span>
                      ) : (
                        <span className="text-muted-main italic">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
