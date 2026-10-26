import React from 'react';
import { Cloud, Search } from 'lucide-react';

interface CloudFilterTabsProps {
  activeFilter: string;
  onChangeFilter: (filter: string) => void;
  activeEnv?: string;
  onChangeEnv?: (env: string) => void;
  counts: {
    all: number;
    aws: number;
    azure: number;
    gcp: number;
    digitalocean: number;
    baremetal: number;
    urls: number;
  };
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const CloudFilterTabs: React.FC<CloudFilterTabsProps> = ({
  activeFilter,
  onChangeFilter,
  activeEnv = 'all',
  onChangeEnv,
  counts,
  searchTerm,
  onSearchChange,
}) => {
  const tabs = [
    { id: 'all', label: 'All Clouds', count: counts.all, icon: '🌐' },
    { id: 'aws', label: 'AWS', count: counts.aws, icon: '🟧' },
    { id: 'azure', label: 'Azure', count: counts.azure, icon: '🟦' },
    { id: 'gcp', label: 'GCP', count: counts.gcp, icon: '🟥' },
    { id: 'digitalocean', label: 'DigitalOcean', count: counts.digitalocean, icon: '🌊' },
    { id: 'baremetal', label: 'Bare Metal', count: counts.baremetal, icon: '🖥️' },
    { id: 'urls', label: 'Websites', count: counts.urls, icon: '🔗' },
  ];

  const envs = [
    { id: 'all', label: 'All Envs', dot: 'bg-gray-400' },
    { id: 'production', label: 'Production', dot: 'bg-emerald-400' },
    { id: 'staging', label: 'Staging', dot: 'bg-amber-400' },
    { id: 'development', label: 'Dev', dot: 'bg-blue-400' },
  ];

  return (
    <div className="flex flex-col gap-3 bg-darkCard border border-darkBorder p-3 rounded-2xl">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Cloud Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeFilter(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-[#0b0f19] text-gray-400 hover:text-white border border-darkBorder/80 hover:border-gray-600'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-blue-800 text-white' : 'bg-darkBorder/60 text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Node Search Bar */}
        <div className="relative w-full md:w-64 flex-shrink-0">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter nodes..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#0b0f19] border border-darkBorder rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Environment Filter Sub-bar */}
      {onChangeEnv && (
        <div className="flex items-center gap-2 pt-2 border-t border-darkBorder/50">
          <span className="text-[11px] text-gray-400 font-medium mr-1">Tier:</span>
          {envs.map((env) => {
            const isEnvActive = activeEnv === env.id;
            return (
              <button
                key={env.id}
                type="button"
                onClick={() => onChangeEnv(env.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  isEnvActive
                    ? 'bg-gray-800 text-white border border-gray-600'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-900/60'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${env.dot}`} />
                <span>{env.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
