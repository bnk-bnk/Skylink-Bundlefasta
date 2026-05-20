import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, Activity, ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

export function AlertsPanel() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);

  const getAlertDetails = (log: any) => {
    const action = log.action || '';
    const newValues = log.new_values || {};
    let message = action.replace(/_/g, ' ');
    let icon = Activity;
    let color = 'text-brand-text/50';

    if (action.includes('FAILURE') || action.includes('ERROR')) {
      message = `API Failure: ${newValues.error || 'Connection timed out'}`;
      icon = AlertCircle;
      color = 'text-status-danger';
    } else if (action === 'MPESA_STK_CALLBACK_PROCESSED') {
      const isSuccess = newValues.status === 'completed';
      message = `STK Push: Transaction for receipt ${newValues.receipt || 'N/A'} was ${newValues.status || 'processed'}`;
      icon = isSuccess ? ShieldCheck : AlertTriangle;
      color = isSuccess ? 'text-status-success' : 'text-status-warning';
    } else if (action === 'MPESA_C2B_CONFIRMATION_PROCESSED') {
      message = `C2B Payment: Received KES ${Number(newValues.amount || 0).toLocaleString()} (Receipt: ${newValues.receipt || 'N/A'})`;
      icon = ShieldCheck;
      color = 'text-status-success';
    } else if (action === 'AUTO_MATCH_RECONCILE') {
      message = `Auto-reconciled: Reference matching succeeded for target account.`;
      icon = ShieldCheck;
      color = 'text-brand-accent';
    } else if (action === 'MANUAL_RECONCILE') {
      message = `Manual reconcile: Settlement applied to customer account.`;
      icon = ShieldCheck;
      color = 'text-brand-accent';
    } else {
      // Clean fallback
      message = `${action.replace(/_/g, ' ')}`;
      if (newValues && Object.keys(newValues).length > 0) {
        message += `: ${JSON.stringify(newValues)}`;
      }
      if (message.length > 100) message = message.substring(0, 100) + '...';
    }

    return { message, icon, color };
  };

  const getRelativeTime = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAlerts(data || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const channel = supabase
      .channel('alerts-panel-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-brand-panel border border-brand-border shadow-sm rounded-2xl p-6 h-full flex flex-col transition-colors duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-brand-text">System Alerts</h3>
          <p className="text-sm text-brand-text/50">Real-time health insights</p>
        </div>
        <div className="relative">
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-status-danger rounded-full animate-pulse"></span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-brand-text/40">
            <RefreshCw className="animate-spin text-brand-accent" size={20} />
            <span className="text-xs">Loading alerts...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 text-brand-text/40 italic text-sm">
            No system alerts logged.
          </div>
        ) : (
          alerts.map(alert => {
            const { message, icon: Icon, color } = getAlertDetails(alert);
            return (
              <div 
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/50 hover:border-brand-border transition-colors duration-300"
              >
                <div className={`mt-0.5 ${color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brand-text/90 leading-snug break-words">{message}</p>
                  <span className="text-xs text-brand-text/40 mt-1 block">{getRelativeTime(alert.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <button 
        onClick={fetchAlerts}
        className="w-full mt-4 py-2.5 text-sm font-semibold text-brand-text/80 hover:text-brand-accent bg-brand-panel border border-brand-border hover:border-brand-accent/50 rounded-xl hover:bg-brand-accent/10 focus:ring-2 focus:ring-brand-accent focus:outline-none transition-all duration-300 flex items-center justify-center gap-1.5"
      >
        <RefreshCw size={14} /> Refresh Logs
      </button>
    </div>
  );
}
