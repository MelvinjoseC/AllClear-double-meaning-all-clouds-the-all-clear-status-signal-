import React, { useState, useEffect } from 'react';
import { Shield, Clock, User, Filter, RefreshCw, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ isOpen, onClose, token }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = filterAction
        ? `/api/audit-logs?action=${encodeURIComponent(filterAction)}`
        : '/api/audit-logs';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, filterAction]);

  if (!isOpen) return null;

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (action.includes('DELETE') || action.includes('REVOKE')) return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (action.includes('UPDATE')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-darkCard border border-darkBorder w-full max-w-4xl rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-darkBorder mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Compliance Audit Trail</h3>
              <p className="text-xs text-gray-400">Tamper-evident record of administrative and infrastructure modifications.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              title="Refresh Logs"
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-darkBorder/40 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-darkBorder/40 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3 mb-4 flex-shrink-0">
          <div className="flex items-center gap-2 bg-[#0b0f19] border border-darkBorder rounded-xl px-3 py-1.5 text-xs text-gray-400">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span>Action Filter:</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="">All Events</option>
              <option value="CREATE_MONITORED_ITEM">Create Monitor</option>
              <option value="DELETE_MONITORED_ITEM">Delete Monitor</option>
              <option value="REVOKE_AGENT_TOKEN">Revoke Agent</option>
            </select>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {logs.length} event{logs.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto border border-darkBorder rounded-2xl divide-y divide-darkBorder">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">
              {loading ? 'Fetching audit records...' : 'No audit events recorded for this tenant yet.'}
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedRow === log.id;
              return (
                <div key={log.id} className="p-4 bg-[#0b0f19]/40 hover:bg-[#0b0f19] transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs font-semibold text-gray-200">
                        {log.resource_type}
                      </span>
                      {log.resource_id && (
                        <span className="text-[10px] font-mono text-gray-500">
                          #{log.resource_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-gray-500" />
                      <span>{log.actor_email}</span>
                      <span className="text-gray-600">•</span>
                      <span className="font-mono text-[11px] text-gray-500">IP: {log.ip_address}</span>
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-all"
                      >
                        {isExpanded ? 'Hide Payload' : 'View Payload'}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <pre className="mt-2.5 p-3 rounded-xl bg-darkCard border border-darkBorder text-[10px] font-mono text-gray-300 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
