import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Cloud, Radio, Server, Globe } from 'lucide-react';
import { MonitoredItem } from '../types';

interface StatusRadarBannerProps {
  items: MonitoredItem[];
}

export const StatusRadarBanner: React.FC<StatusRadarBannerProps> = ({ items }) => {
  const totalCount = items.length;
  const redCount = items.filter((i) => i.status === 'red').length;
  const yellowCount = items.filter((i) => i.status === 'yellow').length;
  const isAllClear = totalCount > 0 && redCount === 0 && yellowCount === 0;
  const isDegraded = redCount === 0 && yellowCount > 0;
  const isOutage = redCount > 0;

  // Multi-cloud breakdown
  const awsCount = items.filter((i) => i.cloud_provider === 'aws').length;
  const azureCount = items.filter((i) => i.cloud_provider === 'azure').length;
  const gcpCount = items.filter((i) => i.cloud_provider === 'gcp').length;
  const webCount = items.filter((i) => i.type === 'url').length;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 md:p-8 border transition-all duration-500 backdrop-blur-xl shadow-2xl ${
        isAllClear
          ? 'bg-gradient-to-r from-emerald-950/40 via-[#0d1c18] to-[#0b1b16] border-emerald-500/40 shadow-emerald-900/20'
          : isDegraded
          ? 'bg-gradient-to-r from-amber-950/40 via-[#1f190e] to-[#1a140b] border-amber-500/40 shadow-amber-900/20'
          : isOutage
          ? 'bg-gradient-to-r from-red-950/50 via-[#261014] to-[#1c0c0f] border-red-500/40 shadow-red-900/30'
          : 'bg-darkCard border-darkBorder'
      }`}
    >
      {/* Background Radar Ambient Glow */}
      <div
        className={`absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl -z-10 ${
          isAllClear
            ? 'bg-emerald-500/10 animate-pulse'
            : isDegraded
            ? 'bg-amber-500/10 animate-pulse'
            : 'bg-red-500/20 animate-pulse'
        }`}
      />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 relative ${
              isAllClear
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                : isDegraded
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                : 'bg-red-500/20 border border-red-500/50 text-red-400'
            }`}
          >
            {isAllClear ? (
              <>
                <ShieldCheck className="w-8 h-8" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </>
            ) : isDegraded ? (
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            ) : (
              <XCircle className="w-8 h-8 animate-pulse" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                <span>AllClear Status Signal</span>
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-xs text-gray-400 font-mono">Live Telemetry</span>
            </div>

            <h2 className="text-2xl font-black tracking-tight text-white font-['Outfit']">
              {totalCount === 0
                ? 'No Nodes Registered'
                : isAllClear
                ? 'ALL SYSTEMS CLEAR — 100% OPERATIONAL'
                : isDegraded
                ? 'DEGRADED PERFORMANCE DETECTED'
                : 'SYSTEM OUTAGE DETECTED'}
            </h2>

            <p className="text-xs md:text-sm text-gray-300 mt-1 max-w-2xl leading-relaxed">
              {totalCount === 0
                ? 'Get started by connecting a Linux server or monitoring a website URL below.'
                : isAllClear
                ? 'Telemetry active across all connected cloud providers and web services. All metrics nominal.'
                : isDegraded
                ? 'High resource consumption or warnings reported on one or more instances. Review alerts below.'
                : 'One or more services have stopped responding. Emergency alert dispatchers have been triggered.'}
            </p>
          </div>
        </div>

        {/* Multi-Cloud Distribution Chips */}
        <div className="flex flex-wrap md:flex-col items-start md:items-end gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#0b0f19]/80 border border-darkBorder px-3 py-1.5 rounded-xl text-xs font-mono">
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-gray-400">Total Nodes:</span>
            <strong className="text-white">{totalCount}</strong>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            {awsCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                AWS: {awsCount}
              </span>
            )}
            {azureCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                Azure: {azureCount}
              </span>
            )}
            {gcpCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-300">
                GCP: {gcpCount}
              </span>
            )}
            {webCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                Web: {webCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
