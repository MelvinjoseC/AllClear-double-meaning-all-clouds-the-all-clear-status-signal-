import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Search, Filter } from 'lucide-react';
import { AlertHistory } from '../types';

interface AlertHistoryTableProps {
  history: AlertHistory[];
}

export const AlertHistoryTable: React.FC<AlertHistoryTableProps> = ({ history }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const filteredHistory = history.filter((alert) => {
    const matchesSearch =
      alert.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.alert_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity =
      filterSeverity === 'all' || alert.severity === filterSeverity || alert.status === filterSeverity;

    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-darkCard p-4 rounded-2xl border border-darkBorder">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search incidents or nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b0f19] border border-darkBorder rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">Filter:</span>
          {['all', 'firing', 'resolved', 'critical'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                filterSeverity === sev
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0b0f19] text-gray-400 hover:text-white border border-darkBorder'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-darkCard border border-darkBorder rounded-2xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No Incidents Found</h3>
          <p className="text-gray-400 text-xs max-w-sm mx-auto">
            All systems are operating normally. Any technical alerts or status changes will be recorded here in plain English.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((alert) => {
            const isFiring = alert.status === 'firing';
            const isSuppressed = alert.status === 'suppressed_maintenance';
            return (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isFiring
                    ? 'bg-red-950/20 border-red-500/30'
                    : isSuppressed
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-darkCard border-darkBorder'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${
                        isFiring
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : isSuppressed
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {isFiring ? (
                        <AlertTriangle className="w-5 h-5 animate-bounce" />
                      ) : isSuppressed ? (
                        <Clock className="w-5 h-5" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-white">{alert.item_name}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-darkBorder/40 text-gray-400">
                          {alert.alert_name}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            isFiring
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : isSuppressed
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {alert.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 mb-2 leading-relaxed">{alert.message}</p>
                      <div className="p-3 bg-[#0b0f19]/70 rounded-xl border border-darkBorder/60 flex items-start gap-2">
                        <span className="text-blue-400 text-xs font-semibold flex-shrink-0">💡 Suggested Step:</span>
                        <span className="text-xs text-gray-300">{alert.suggested_action}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 text-[11px] text-gray-500 flex flex-col items-end">
                    <span className="font-mono">{new Date(alert.starts_at).toLocaleTimeString()}</span>
                    <span>{new Date(alert.starts_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
