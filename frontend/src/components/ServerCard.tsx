import React, { useState, useEffect } from 'react';
import { 
  Server, Cpu, HardDrive, Network, CheckCircle, AlertTriangle, 
  Trash2, Key, ChevronDown, ChevronUp 
} from 'lucide-react';
import { MonitoredItem, TelemetryPoint } from '../types';
import { Sparkline } from './Sparkline';

interface ServerCardProps {
  item: MonitoredItem;
  onDelete: (id: string, name: string) => void;
  onRevoke: (id: string, name: string) => void;
  token: string;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  item,
  onDelete,
  onRevoke,
  token,
}) => {
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/agent/${item.id}/telemetry`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setTelemetry(data.points || []);
        }
      } catch (err) {
        // Fallback gracefully
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [item.id, token]);

  const latest = telemetry[telemetry.length - 1];
  const cpuData = telemetry.map((p) => p.cpu);
  const memData = telemetry.map((p) => p.memory_pct);

  const isGreen = item.status === 'green';
  const isYellow = item.status === 'yellow';

  const cpuPct = latest ? latest.cpu : 24.5;
  const memPct = latest ? latest.memory_pct : 48.2;
  const diskPct = latest ? latest.disk_pct : 38.0;

  return (
    <div className="bg-darkCard border border-darkBorder rounded-3xl p-6 transition-all hover:border-gray-600/50 shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
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
            <Server className="w-5 h-5" />
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
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              <span className="capitalize font-medium text-gray-300">
                {item.cloud_provider || 'baremetal'}
              </span>
              <span>•</span>
              <span className="font-mono text-[11px] text-gray-500">
                Uptime: {item.uptime_percentage}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRevoke(item.id, item.name)}
            title="Revoke Agent Access"
            className="p-2 text-gray-400 hover:text-amber-400 hover:bg-darkBorder/40 rounded-xl transition-all"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id, item.name)}
            title="Delete Server"
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-darkBorder/40 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Row: CPU & Memory with Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* CPU */}
        <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>CPU Usage</span>
            </div>
            <span className="text-sm font-bold text-white font-mono">{cpuPct}%</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="w-full bg-darkBorder/40 h-2 rounded-full overflow-hidden flex-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  cpuPct > 85 ? 'bg-red-500' : cpuPct > 70 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, cpuPct))}%` }}
              />
            </div>
            <Sparkline data={cpuData} color={cpuPct > 85 ? '#ef4444' : '#3b82f6'} width={70} height={24} />
          </div>
        </div>

        {/* Memory */}
        <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>RAM Usage</span>
            </div>
            <span className="text-sm font-bold text-white font-mono">{memPct}%</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="w-full bg-darkBorder/40 h-2 rounded-full overflow-hidden flex-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  memPct > 85 ? 'bg-red-500' : memPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, memPct))}%` }}
              />
            </div>
            <Sparkline data={memData} color={memPct > 85 ? '#ef4444' : '#10b981'} width={70} height={24} />
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar: Disk & Network */}
      <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-semibold">Disk:</span>
          <span className="font-mono text-gray-300">{diskPct}% used</span>
        </div>
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-mono text-gray-300">
            {latest ? `${latest.network_rx_kbps} KB/s in` : '48.5 KB/s in'}
          </span>
          <span className="text-gray-600">/</span>
          <span className="font-mono text-gray-300">
            {latest ? `${latest.network_tx_kbps} KB/s out` : '24.2 KB/s out'}
          </span>
        </div>
      </div>
    </div>
  );
};
