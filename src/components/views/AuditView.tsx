'use client';

import React, { useEffect, useState } from 'react';
import { History, Shield, Server, User, Search, RefreshCw } from 'lucide-react';
import { getAuditLogsAction } from '@/app/actions';

export default function AuditView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const renderDetails = (meta: any) => {
    if (!meta) return '-';
    try {
      return Object.entries(meta)
        .map(([key, val]) => {
          // Clean up formatting
          const cleanKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
          return `${cleanKey}: ${JSON.stringify(val)}`;
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

  return (
    <div className="space-y-4">
      
      {/* Search Logs Bar */}
      <div className="bg-panel border border-border-main rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-muted-main" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-border-main rounded-lg bg-background"
            placeholder="Search action or operator email..."
          />
        </div>
        
        <button
          onClick={loadLogs}
          className="flex items-center justify-center p-2 border border-border-main text-muted-main hover:text-text-main hover:bg-background rounded-lg transition-colors shrink-0"
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main text-xs font-medium">
              {loading ? (
                [...Array(5)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={4} className="py-4 px-4 h-12 bg-panel" />
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-muted-main">
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
                      <td className="py-3 px-4 text-muted-main font-mono max-w-md truncate" title={JSON.stringify(log.metadata)}>
                        {renderDetails(log.metadata)}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-muted-main font-mono">
                        {new Date(log.created_at).toLocaleString('en-KE')}
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
