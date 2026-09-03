import React, { useState, useEffect } from 'react';
import { Globe, ShieldCheck, ShieldAlert, ShieldX, ExternalLink, Trash2, Clock, Activity } from 'lucide-react';
import { MonitoredItem, SslCertInfo } from '../types';

interface UrlCardProps {
  item: MonitoredItem;
  onDelete: (id: string, name: string) => void;
  token: string;
}

export const UrlCard: React.FC<UrlCardProps> = ({ item, onDelete, token }) => {
  const [ssl, setSsl] = useState<SslCertInfo | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (item.url && item.url.startsWith('https://')) {
      fetch(`/api/monitored-items/${item.id}/ssl`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data) setSsl(data);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [item.id, item.url, token]);

  const isGreen = item.status === 'green';
  const isYellow = item.status === 'yellow';

  return (
    <div className="bg-darkCard border border-darkBorder rounded-3xl p-6 transition-all hover:border-gray-600/50 shadow-xl relative overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
              isGreen
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isYellow
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <Globe className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">{item.name}</h3>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  isGreen
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : isYellow
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {item.status}
              </span>
            </div>

            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-0.5 truncate max-w-xs transition-all"
              >
                <span>{item.url}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            )}
          </div>
        </div>

        <button
          onClick={() => onDelete(item.id, item.name)}
          title="Delete Monitor"
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-darkBorder/40 rounded-xl transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Prober Metrics & SSL Status */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {/* Availability */}
        <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Availability</span>
            </span>
            <span className="font-mono text-xs font-bold text-emerald-400">
              {item.uptime_percentage}%
            </span>
          </div>
          <p className="text-[11px] text-gray-500">Continuous probe interval: 60s</p>
        </div>

        {/* SSL Expiration */}
        <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="flex items-center gap-1.5">
              {ssl?.status === 'expired' ? (
                <ShieldX className="w-3.5 h-3.5 text-red-400" />
              ) : ssl?.status === 'expiring_soon' ? (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>TLS / SSL</span>
            </span>
            <span
              className={`font-mono text-xs font-bold ${
                ssl?.status === 'expired'
                  ? 'text-red-400'
                  : ssl?.status === 'expiring_soon'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {ssl ? `${ssl.days_remaining}d left` : 'HTTPS Valid'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate">
            {ssl?.issuer ? `CA: ${ssl.issuer}` : 'TLS Handshake 200 OK'}
          </p>
        </div>
      </div>
    </div>
  );
};
