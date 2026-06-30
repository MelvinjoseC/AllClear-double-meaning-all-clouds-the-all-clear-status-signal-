import React, { useState, useEffect } from 'react';
import { 
  Shield, Activity, Server, Globe, AlertTriangle, CheckCircle, 
  Trash2, X, Play, RefreshCw, Send, Plus, Key, HelpCircle, 
  ChevronRight, LogOut, Settings, Phone, Mail, Clock, Database,
  Cpu, HardDrive, LayoutGrid
} from 'lucide-react';

const API_BASE = '/api';

interface MonitoredItem {
  id: string;
  tenant_id: string;
  type: 'server' | 'url';
  name: string;
  url: string | null;
  status: 'green' | 'yellow' | 'red';
  last_checked_at: string | null;
  uptime_percentage: string;
  created_at: string;
}

interface AlertHistory {
  id: string;
  tenant_id: string;
  monitored_item_id: string;
  item_name: string;
  item_type: string;
  alert_name: string;
  severity: string;
  status: 'firing' | 'resolved';
  message: string;
  suggested_action: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  tenantId: string;
  companyName: string;
}

export default function App() {
  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');
  
  // Data State
  const [items, setItems] = useState<MonitoredItem[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authCompany, setAuthCompany] = useState('');

  // Add Item Form State
  const [itemType, setItemType] = useState<'server' | 'url'>('url');
  const [itemName, setItemName] = useState('');
  const [itemUrl, setItemUrl] = useState('');
  const [itemProcesses, setItemProcesses] = useState('');
  
  // Settings Form State
  const [whatsappNum, setWhatsappNum] = useState('');

  // Onboarding polling overlay
  const [onboardingItem, setOnboardingItem] = useState<{ id: string; command: string; name: string } | null>(null);
  const [onboardingSeconds, setOnboardingSeconds] = useState(120);
  const [onboardingSuccess, setOnboardingSuccess] = useState(false);

  // Fetch initial profile
  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  // Periodic Refresh
  useEffect(() => {
    if (token) {
      fetchData();
      const interval = setInterval(fetchData, 10000); // refresh every 10s
      return () => clearInterval(interval);
    }
  }, [token]);

  // Onboarding Polling Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let pollInterval: NodeJS.Timeout;

    if (onboardingItem && !onboardingSuccess) {
      if (onboardingSeconds <= 0) {
        return;
      }
      
      // Timer tick
      timer = setTimeout(() => {
        setOnboardingSeconds(prev => prev - 1);
      }, 1000);

      // Poll endpoint every 5s
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/monitored-items/${onboardingItem.id}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'green') {
              setOnboardingSuccess(true);
              fetchData();
            }
          }
        } catch (err) {
          console.error(err);
        }
      }, 5000);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
    };
  }, [onboardingItem, onboardingSeconds, onboardingSuccess, token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setWhatsappNum(data.user.whatsappName || '');
      } else {
        handleLogout();
      }
    } catch (err) {
      handleLogout();
    }
  };

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [itemsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/monitored-items`, { headers }),
        fetch(`${API_BASE}/alerts/history`, { headers })
      ]);
      
      if (itemsRes.ok && historyRes.ok) {
        setItems(await itemsRes.json());
        setHistory(await historyRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrMessage(null);
    
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const payload = authMode === 'login' 
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, companyName: authCompany };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setSuccessMessage(authMode === 'login' ? 'Logged in successfully.' : 'Account created successfully.');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrMessage(data.error || 'Authentication failed.');
      }
    } catch (err) {
      setErrMessage('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setItems([]);
    setHistory([]);
  };

  const handleUpdateWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrMessage(null);

    try {
      const res = await fetch(`${API_BASE}/auth/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ whatsappNumber: whatsappNum })
      });

      if (res.ok) {
        setSuccessMessage('WhatsApp routing successfully updated.');
        setShowSettingsModal(false);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await res.json();
        setErrMessage(data.error || 'Failed to update settings.');
      }
    } catch (err) {
      setErrMessage('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrMessage(null);

    const payload = {
      type: itemType,
      name: itemName,
      url: itemType === 'url' ? itemUrl : undefined,
      processes: itemType === 'server' ? itemProcesses.split(',').map(p => p.trim()) : undefined
    };

    try {
      const res = await fetch(`${API_BASE}/monitored-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setShowAddModal(false);
        fetchData();
        
        if (itemType === 'server') {
          // Open onboarding polling overlay
          setOnboardingItem({
            id: data.item.id,
            command: data.installCommand,
            name: data.item.name
          });
          setOnboardingSeconds(120);
          setOnboardingSuccess(false);
        } else {
          setSuccessMessage('Website registered successfully.');
          setTimeout(() => setSuccessMessage(null), 3000);
        }

        // Reset Form
        setItemName('');
        setItemUrl('');
        setItemProcesses('');
      } else {
        setErrMessage(data.error || 'Failed to register monitored item.');
      }
    } catch (err) {
      setErrMessage('Network failure during registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to stop monitoring and delete "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/monitored-items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccessMessage(`Deleted "${name}"`);
        fetchData();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      alert('Failed to delete item.');
    }
  };

  const handleRevokeToken = async (id: string, name: string) => {
    if (!confirm(`WARNING: Revoking the token for "${name}" will disconnect it permanently and set its status to offline. Proceed?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/agent/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ monitored_item_id: id })
      });

      if (res.ok) {
        setSuccessMessage(`Revoked agent access for "${name}"`);
        fetchData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to revoke token.');
      }
    } catch (err) {
      alert('Error revoking token.');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b0f19] via-[#111827] to-[#0f172a] px-4">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-900/10 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>

        <div className="w-full max-w-md bg-darkCard border border-darkBorder rounded-2xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-blue-600/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">CloudMon</h2>
            <p className="text-gray-400 text-sm mt-1">Simple monitoring for small business servers & URLs</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {authMode === 'register' && (
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">Company Name</label>
                <input 
                  type="text" 
                  className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-3 text-white focus:outline-none transition-all"
                  placeholder="e.g. Acme Inc"
                  value={authCompany}
                  onChange={e => setAuthCompany(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-3 text-white focus:outline-none transition-all"
                placeholder="you@company.com"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-3 text-white focus:outline-none transition-all"
                placeholder="••••••••"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
              />
            </div>

            {errMessage && (
              <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-3 flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errMessage}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw className="w-5 h-5 animate-spin" />}
              <span>{authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setErrMessage(null);
              }}
              className="text-blue-500 hover:text-blue-400 text-sm font-medium transition-all"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0b0f19] text-[#e2e8f0]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-darkBorder bg-[#0d1322] flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="h-16 flex items-center gap-3 px-6 border-b border-darkBorder">
            <Shield className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-bold tracking-tight text-white font-['Outfit']">CloudMon</span>
          </div>

          <div className="px-4 py-6 space-y-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'dashboard' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' 
                  : 'text-gray-400 hover:text-white hover:bg-darkBorder/40'
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            <button 
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'history' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' 
                  : 'text-gray-400 hover:text-white hover:bg-darkBorder/40'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>Alert History</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-darkBorder space-y-3">
          <div className="bg-[#0b0f19] rounded-xl p-3 border border-darkBorder">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Company</p>
            <p className="text-sm font-bold text-white mt-0.5 truncate">{user?.companyName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>

          <button 
            onClick={() => setShowSettingsModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-darkBorder hover:bg-darkBorder/40 text-sm font-medium transition-all text-gray-300 hover:text-white"
          >
            <Settings className="w-4 h-4" />
            <span>Alert Settings</span>
          </button>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 bg-red-950/10 hover:bg-red-950/20 text-sm font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-darkBorder bg-[#0d1322]/40 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-2xl font-bold tracking-tight">
            {activeTab === 'dashboard' ? 'Infrastructure Health' : 'Security Alert logs'}
          </h1>

          <div className="flex items-center gap-4">
            {activeTab === 'dashboard' && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl transition-all shadow-lg flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add App / Server</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Notification Messages */}
          {successMessage && (
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3 text-emerald-400 text-sm shadow-xl shadow-emerald-950/10 animate-fade-in">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-darkBorder rounded-3xl p-16 text-center max-w-2xl mx-auto bg-darkCard/20">
                  <div className="w-16 h-16 bg-blue-900/15 border border-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                    <Activity className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No monitored nodes yet</h3>
                  <p className="text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
                    CloudMon monitors your websites and servers. Get started by registering your first application.
                  </p>
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Register your first target</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map(item => {
                    const statusColorMap = {
                      green: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', glow: 'bg-emerald-500', text: 'text-emerald-400' },
                      yellow: { border: 'border-amber-500/20', bg: 'bg-amber-500/10', glow: 'bg-amber-500', text: 'text-amber-400' },
                      red: { border: 'border-rose-500/20', bg: 'bg-rose-500/10', glow: 'bg-rose-500', text: 'text-rose-400' }
                    };
                    const statusColors = statusColorMap[item.status] || statusColorMap.green;

                    return (
                      <div 
                        key={item.id}
                        className={`bg-darkCard border ${statusColors.border} rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:scale-[1.01]`}
                      >
                        {/* Glowing pulse indicator in the top right */}
                        <div className="absolute top-6 right-6 flex items-center gap-2">
                          <span className={`relative flex h-3 w-3`}>
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusColors.glow} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${statusColors.glow}`}></span>
                          </span>
                          <span className={`text-xs font-bold uppercase tracking-wider ${statusColors.text}`}>
                            {item.status === 'green' ? 'healthy' : item.status === 'yellow' ? 'warning' : 'offline'}
                          </span>
                        </div>

                        {/* Card Content */}
                        <div className="flex gap-4 items-start">
                          <div className="w-12 h-12 bg-darkBorder/40 border border-darkBorder rounded-xl flex items-center justify-center">
                            {item.type === 'server' ? (
                              <Server className="w-6 h-6 text-blue-400" />
                            ) : (
                              <Globe className="w-6 h-6 text-indigo-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold truncate text-white max-w-[200px]">{item.name}</h3>
                            <p className="text-gray-400 text-xs truncate mt-0.5 max-w-[200px]">
                              {item.type === 'server' ? 'Agent Node' : item.url}
                            </p>
                          </div>
                        </div>

                        {/* Metrics summary */}
                        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-darkBorder/40">
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Uptime Ratio</p>
                            <p className="text-xl font-bold text-white mt-1">{item.uptime_percentage}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Last Checked</p>
                            <p className="text-xs text-gray-300 mt-2 truncate">
                              {item.last_checked_at ? new Date(item.last_checked_at).toLocaleTimeString() : 'Never'}
                            </p>
                          </div>
                        </div>

                        {/* Node actions */}
                        <div className="mt-6 flex justify-between gap-3">
                          {item.type === 'server' && (
                            <button
                              onClick={() => handleRevokeToken(item.id, item.name)}
                              className="text-xs text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 bg-rose-950/10 rounded-lg px-3 py-1.5 font-medium transition-all"
                            >
                              Revoke Access
                            </button>
                          )}
                          <div className="flex-1"></div>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="text-xs text-gray-400 hover:text-white border border-darkBorder hover:bg-darkBorder/40 rounded-lg p-1.5 font-medium transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-darkCard border border-darkBorder rounded-2xl shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-darkBorder flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Event Log</h3>
                <span className="text-xs text-gray-400 font-medium bg-darkBg border border-darkBorder px-2.5 py-1 rounded-full">
                  {history.length} Event{history.length !== 1 ? 's' : ''} logged
                </span>
              </div>

              {history.length === 0 ? (
                <div className="p-16 text-center">
                  <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">No alert events on record. Everything is running smoothly!</p>
                </div>
              ) : (
                <div className="divide-y divide-darkBorder/40">
                  {history.map(evt => {
                    const isFiring = evt.status === 'firing';
                    return (
                      <div key={evt.id} className="p-6 hover:bg-darkBorder/10 transition-all flex gap-4 items-start">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                          isFiring 
                            ? 'bg-rose-950/15 border-rose-500/20 text-rose-400' 
                            : 'bg-emerald-950/15 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {isFiring ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-bold text-white">{evt.item_name}</span>
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">({evt.item_type})</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                              isFiring 
                                ? 'bg-rose-950/20 border-rose-500/30 text-rose-400' 
                                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                            }`}>
                              {evt.status}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-300 mt-2 leading-relaxed">{evt.message}</p>
                          {isFiring && (
                            <div className="mt-3 bg-[#0b0f19] border border-darkBorder rounded-xl p-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Suggested Recovery Step:</p>
                              <p className="text-xs text-gray-300 mt-1 leading-relaxed">{evt.suggested_action}</p>
                            </div>
                          )}

                          <div className="flex gap-4 text-xs text-gray-500 mt-3 font-medium">
                            <span>Started: {new Date(evt.starts_at).toLocaleString()}</span>
                            {evt.ends_at && (
                              <span>Resolved: {new Date(evt.ends_at).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: ADD NEW MONITORED ITEM */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-lg bg-darkCard border border-darkBorder rounded-2xl shadow-2xl relative overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-darkBorder flex justify-between items-center bg-[#0d1322]/40">
              <h3 className="text-xl font-bold text-white">Add New App / Server</h3>
              <button onClick={() => { setShowAddModal(false); setErrMessage(null); }} className="text-gray-400 hover:text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-6 space-y-5">
              {/* Type Switcher */}
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wider">Monitoring Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setItemType('url')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                      itemType === 'url'
                        ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                        : 'border-darkBorder text-gray-400 hover:text-white hover:bg-darkBorder/20'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>Website URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType('server')}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                      itemType === 'server'
                        ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                        : 'border-darkBorder text-gray-400 hover:text-white hover:bg-darkBorder/20'
                    }`}
                  >
                    <Server className="w-4 h-4" />
                    <span>Linux Server</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-3 text-white focus:outline-none transition-all text-sm"
                  placeholder="e.g. Production Web server"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  required
                />
              </div>

              {itemType === 'url' ? (
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Website Address (URL)</label>
                  <input
                    type="url"
                    className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-3 text-white focus:outline-none transition-all text-sm"
                    placeholder="https://example.com"
                    value={itemUrl}
                    onChange={e => setItemUrl(e.target.value)}
                    required
                  />
                  <p className="text-gray-500 text-[11px] mt-1.5">
                    CloudMon will check response codes and uptime every 1-2 mins.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Services to Monitor (Uptime)</label>
                  <input
                    type="text"
                    className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-3 text-white focus:outline-none transition-all text-sm"
                    placeholder="nginx, postgresql (comma separated)"
                    value={itemProcesses}
                    onChange={e => setItemProcesses(e.target.value)}
                  />
                  <p className="text-gray-500 text-[11px] mt-1.5">
                    Check if specific service processes are running on your server.
                  </p>
                </div>
              )}

              {errMessage && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errMessage}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {loading && <RefreshCw className="w-5 h-5 animate-spin" />}
                  <span>{itemType === 'server' ? 'Generate Installer Command' : 'Add Website Monitor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NOTIFICATIONS SETTINGS */}
      {showSettingsModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-md bg-darkCard border border-darkBorder rounded-2xl shadow-2xl relative overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-darkBorder flex justify-between items-center bg-[#0d1322]/40">
              <h3 className="text-lg font-bold text-white">Alert Routing Settings</h3>
              <button onClick={() => { setShowSettingsModal(false); setErrMessage(null); }} className="text-gray-400 hover:text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateWhatsapp} className="p-6 space-y-5">
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">WhatsApp Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-3.5 text-gray-500 w-4 h-4" />
                  <input
                    type="tel"
                    className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none transition-all text-sm"
                    placeholder="e.g. +14155238886"
                    value={whatsappNum}
                    onChange={e => setWhatsappNum(e.target.value)}
                  />
                </div>
                <p className="text-gray-500 text-[11px] mt-1.5 leading-relaxed">
                  Enter your number in international format. Make sure you opt-in to your Twilio sandbox channel to receive alert messages.
                </p>
              </div>

              {errMessage && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errMessage}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {loading && <RefreshCw className="w-5 h-5 animate-spin" />}
                  <span>Save Config</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY: ONBOARDING POLLING SCREEN */}
      {onboardingItem && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md z-50 p-4">
          <div className="w-full max-w-2xl bg-darkCard border border-darkBorder rounded-3xl p-8 shadow-2xl relative">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white font-['Outfit']">Install Agent: {onboardingItem.name}</h3>
                <p className="text-sm text-gray-400 mt-1">Follow these steps to connect your server to CloudMon</p>
              </div>
              <button 
                onClick={() => setOnboardingItem(null)} 
                className="text-gray-400 hover:text-white p-1 hover:bg-darkBorder/40 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            {!onboardingSuccess ? (
              <div className="space-y-6">
                <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Copy & Run Installer Command</p>
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    Paste this command into your server shell terminal and press Enter. Requires root/sudo privileges during setup.
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={onboardingItem.command}
                      className="flex-1 bg-[#070b12] border border-darkBorder rounded-xl px-4 py-3 text-xs text-blue-400 font-mono focus:outline-none select-all"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(onboardingItem.command);
                        alert('Copied installer command!');
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl transition-all text-xs"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="border border-darkBorder rounded-2xl p-5 flex flex-col items-center justify-center text-center bg-darkCard">
                  {onboardingSeconds > 0 ? (
                    <>
                      <div className="w-12 h-12 bg-blue-900/20 border border-blue-500/20 rounded-full flex items-center justify-center mb-4 relative">
                        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Awaiting first agent check-in...</h4>
                      <p className="text-xs text-gray-400 mt-1.5 max-w-sm leading-relaxed">
                        Waiting for metrics telemetry. Setup will complete automatically. Remaining time: <strong className="text-blue-400">{onboardingSeconds}s</strong>
                      </p>
                    </>
                  ) : (
                    <div className="text-left w-full space-y-4">
                      <div className="flex gap-2 items-center text-amber-400">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <h4 className="text-sm font-bold">Onboarding timeout reached</h4>
                      </div>
                      <div className="bg-[#0b0f19] border border-darkBorder rounded-xl p-4 space-y-2 text-xs">
                        <p className="font-semibold text-gray-400">Troubleshooting checklist:</p>
                        <ul className="list-disc pl-5 space-y-1.5 text-gray-300">
                          <li>Verify Python 3 is installed on your server (<code>python3 --version</code>)</li>
                          <li>Confirm systemd is available (<code>systemctl --version</code>)</li>
                          <li>Check if agent process has started (<code>systemctl status cloudmon-agent</code>)</li>
                          <li>Inspect agent error logs (<code>journalctl -u cloudmon-agent -n 20</code>)</li>
                          <li>Ensure your server can reach the CloudMon endpoint (<code>curl -I https://localhost/api/health</code>)</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 bg-emerald-950/20 border border-emerald-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>
                <h4 className="text-xl font-bold text-white">Server connected successfully!</h4>
                <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
                  Metrics report successfully received. Your server is now monitored and status updates will reflect on the dashboard.
                </p>
                <button
                  onClick={() => setOnboardingItem(null)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-all text-sm mt-2"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
