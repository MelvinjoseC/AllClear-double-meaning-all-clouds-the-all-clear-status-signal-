import React from 'react';
import { 
  Shield, Activity, Clock, Settings, LogOut, Globe, Bell, Calendar
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'history' | 'maintenance' | 'channels' | 'statuspage';
  setActiveTab: (tab: 'dashboard' | 'history' | 'maintenance' | 'channels' | 'statuspage') => void;
  user: User | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  firingCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onOpenSettings,
  firingCount,
}) => {
  return (
    <aside className="w-64 border-r border-darkBorder bg-[#0d1322] flex flex-col justify-between flex-shrink-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-darkBorder">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white font-['Outfit']">AllClear</span>
            <span className="ml-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-700/50">
              v1.1
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <div className="px-4 py-6 space-y-1.5">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-darkCard'
            }`}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4" />
              <span>Multi-Cloud Radar</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-darkCard'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4" />
              <span>Incident History</span>
            </div>
            {firingCount > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {firingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'channels'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-darkCard'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Alert Channels</span>
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'maintenance'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-darkCard'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Maintenance</span>
          </button>

          <button
            onClick={() => setActiveTab('statuspage')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'statuspage'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-darkCard'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Public Status Page</span>
          </button>
        </div>
      </div>

      {/* User Profile & Actions */}
      <div className="p-4 border-t border-darkBorder">
        {user && (
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold text-white truncate">{user.companyName}</p>
            <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            title="Settings"
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-darkCard border border-darkBorder hover:border-gray-600 text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-2 bg-darkCard border border-darkBorder hover:border-red-500/50 text-gray-400 hover:text-red-400 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
