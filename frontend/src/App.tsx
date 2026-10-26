import React, { useState, useEffect } from 'react';
import { 
  Shield, Activity, Server, Globe, AlertTriangle, CheckCircle, 
  Trash2, X, Play, RefreshCw, Send, Plus, Key, HelpCircle, 
  ChevronRight, LogOut, Settings, Phone, Mail, Clock, Database,
  Cpu, HardDrive, LayoutGrid, Radio
} from 'lucide-react';
import { MonitoredItem, AlertHistory, User, CloudProvider } from './types';
import { Sidebar } from './components/Sidebar';
import { StatusRadarBanner } from './components/StatusRadarBanner';
import { CloudFilterTabs } from './components/CloudFilterTabs';
import { ServerCard } from './components/ServerCard';
import { UrlCard } from './components/UrlCard';
import { AlertHistoryTable } from './components/AlertHistoryTable';
import { ChannelSettingsModal } from './components/ChannelSettingsModal';
import { PublicStatusModal } from './components/PublicStatusModal';
import { AuditLogViewer } from './components/AuditLogViewer';

const API_BASE = '/api';

export default function App() {
  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'maintenance' | 'channels' | 'statuspage'>('dashboard');
  
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
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  
  // Filtering
  const [cloudFilter, setCloudFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authCompany, setAuthCompany] = useState('');
  
  // Registration Form State
  const [itemType, setItemType] = useState<'server' | 'url'>('url');
  const [itemName, setItemName] = useState('');
  const [itemUrl, setItemUrl] = useState('');
  const [itemCloud, setItemCloud] = useState<CloudProvider>('aws');
  const [itemProcesses, setItemProcesses] = useState('');
  const [registeredCommand, setRegisteredCommand] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Settings State
  const [whatsappNum, setWhatsappNum] = useState('');

  useEffect(() => {
    if (token) {
      validateSession();
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Handle Tab changes that open modals
  useEffect(() => {
    if (activeTab === 'channels') {
      setShowChannelModal(true);
      setActiveTab('dashboard');
    } else if (activeTab === 'statuspage') {
      setShowStatusModal(true);
      setActiveTab('dashboard');
    }
  }, [activeTab]);

  const validateSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
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
      const headers = { Authorization: `Bearer ${token}` };
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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrMessage(null);

    const payload = {
      type: itemType,
      name: itemName,
      url: itemType === 'url' ? itemUrl : null,
      cloud_provider: itemCloud,
      processes: itemType === 'server' ? itemProcesses.split(',').map(s => s.trim()).filter(Boolean) : []
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
        fetchData();
        if (itemType === 'server' && data.installCommand) {
          setRegisteredCommand(data.installCommand);
        } else {
          setShowAddModal(false);
          resetItemForm();
          setSuccessMessage('Monitored target registered successfully.');
          setTimeout(() => setSuccessMessage(null), 3000);
        }
      } else {
        setErrMessage(data.error || 'Failed to add target.');
      }
    } catch (err) {
      setErrMessage('Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const resetItemForm = () => {
    setItemName('');
    setItemUrl('');
    setItemProcesses('');
    setRegisteredCommand(null);
    setCopiedCmd(false);
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/monitored-items/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchData();
        setSuccessMessage(`"${name}" was deleted successfully.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrMessage('Failed to delete item.');
      }
    } catch (err) {
      setErrMessage('Failed to connect to the server.');
    }
  };

  const handleRevokeToken = async (id: string, name: string) => {
    if (!window.confirm(`Revoke agent connection for "${name}"? The agent will stop reporting.`)) return;

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
        fetchData();
        setSuccessMessage(`Agent connection revoked for "${name}".`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrMessage('Failed to revoke agent token.');
      }
    } catch (err) {
      setErrMessage('Failed to connect to the server.');
    }
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
        setSuccessMessage('WhatsApp notifications configured.');
        setTimeout(() => setSuccessMessage(null), 3000);
        setShowSettingsModal(false);
      } else {
        setErrMessage('Failed to update notifications.');
      }
    } catch (err) {
      setErrMessage('Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (email: string) => {
    setAuthEmail(email);
    setAuthPassword('password123');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
      } else {
        setErrMessage(data.error || 'Demo login failed');
      }
    } catch (e) {
      setErrMessage('Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.url && item.url.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesCloud = true;
    if (cloudFilter === 'urls') {
      matchesCloud = item.type === 'url';
    } else if (cloudFilter !== 'all') {
      matchesCloud = item.cloud_provider === cloudFilter;
    }

    let matchesEnv = true;
    if (envFilter !== 'all') {
      matchesEnv = (item.environment || 'production') === envFilter;
    }

    return matchesSearch && matchesCloud && matchesEnv;
  });

  const filterCounts = {
    all: items.length,
    aws: items.filter(i => i.cloud_provider === 'aws').length,
    azure: items.filter(i => i.cloud_provider === 'azure').length,
    gcp: items.filter(i => i.cloud_provider === 'gcp').length,
    digitalocean: items.filter(i => i.cloud_provider === 'digitalocean').length,
    baremetal: items.filter(i => i.cloud_provider === 'baremetal' || !i.cloud_provider).length,
    urls: items.filter(i => i.type === 'url').length,
  };

  const firingCount = history.filter(h => h.status === 'firing').length;

  // Unauthenticated View
  if (!token) {
    return (
      <div className="min-h-screen bg-[#070a13] flex flex-col justify-center items-center p-4 font-['Inter'] relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-full max-w-md bg-[#0d1322] border border-darkBorder rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-xl">
          <div className="flex items-center gap-3 justify-center mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white font-['Outfit'] tracking-tight">AllClear</h1>
              <p className="text-[11px] text-blue-400 font-semibold uppercase tracking-wider">Multi-Cloud Observability Engine</p>
            </div>
          </div>

          <div className="flex bg-[#0b0f19] p-1 rounded-xl mb-6 border border-darkBorder">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                authMode === 'login' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                authMode === 'register' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {errMessage && (
            <div className="mb-4 p-3 bg-red-950/30 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errMessage}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1">Company / Organization</label>
                <input
                  type="text"
                  required
                  placeholder="Acme Cloud Systems"
                  value={authCompany}
                  onChange={(e) => setAuthCompany(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-1">Work Email</label>
              <input
                type="email"
                required
                placeholder="devops@company.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-semibold mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              {loading ? 'Authenticating...' : authMode === 'login' ? 'Sign In to Radar' : 'Create Organization'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-darkBorder text-center">
            <p className="text-[11px] text-gray-400 mb-2">Quick Evaluation Demo Access:</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDemoSignIn('admin@techcorp.com')}
                className="flex-1 py-1.5 px-2 bg-[#0b0f19] hover:bg-darkBorder border border-darkBorder rounded-lg text-[11px] text-blue-400 hover:text-white transition-all font-mono"
              >
                TechCorp Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoSignIn('ops@devcloud.io')}
                className="flex-1 py-1.5 px-2 bg-[#0b0f19] hover:bg-darkBorder border border-darkBorder rounded-lg text-[11px] text-purple-400 hover:text-white transition-all font-mono"
              >
                DevCloud Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Main View
  return (
    <div className="min-h-screen bg-[#070a13] text-white flex font-['Inter'] antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenAuditLogs={() => setShowAuditModal(true)}
        firingCount={firingCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 border-b border-darkBorder px-8 flex items-center justify-between bg-[#0d1322]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white tracking-tight">
              {activeTab === 'dashboard' ? 'Multi-Cloud Observability' : 'Incident Log & Resolution History'}
            </span>
            <span className="text-gray-600">•</span>
            <span className="text-xs text-gray-400 font-mono">
              Tenant: {user?.companyName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#0b0f19] hover:bg-darkBorder border border-darkBorder rounded-xl text-xs font-medium text-gray-300 hover:text-white transition-all"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Status Page</span>
            </button>

            <button
              onClick={() => setShowChannelModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#0b0f19] hover:bg-darkBorder border border-darkBorder rounded-xl text-xs font-medium text-gray-300 hover:text-white transition-all"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Alert Channels</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Monitor</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* Notifications Banner */}
          {successMessage && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-300 animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-xs text-red-300 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errMessage}</span>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <>
              {/* Radar Status Signal Banner */}
              <StatusRadarBanner items={items} />

              {/* Cloud Provider Filtering Bar */}
              <CloudFilterTabs
                activeFilter={cloudFilter}
                onChangeFilter={setCloudFilter}
                activeEnv={envFilter}
                onChangeEnv={setEnvFilter}
                counts={filterCounts}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />

              {/* Nodes Grid */}
              {filteredItems.length === 0 ? (
                <div className="bg-darkCard border border-darkBorder rounded-3xl p-12 text-center">
                  <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white mb-1">No Monitored Nodes Found</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
                    {searchTerm ? 'No nodes match your current search query.' : 'Connect your first server or monitor a public URL.'}
                  </p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Add Monitored Node
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredItems.map((item) =>
                    item.type === 'server' ? (
                      <ServerCard
                        key={item.id}
                        item={item}
                        onDelete={handleDeleteItem}
                        onRevoke={handleRevokeToken}
                        token={token}
                      />
                    ) : (
                      <UrlCard
                        key={item.id}
                        item={item}
                        onDelete={handleDeleteItem}
                        token={token}
                      />
                    )
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <AlertHistoryTable history={history} />
          )}
        </div>
      </main>

      {/* Add Monitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-darkCard border border-darkBorder w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-darkBorder mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Register Monitored Target</h3>
                  <p className="text-xs text-gray-400">Deploy continuous health probing and telemetry.</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddModal(false); resetItemForm(); }}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-darkBorder/40 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {registeredCommand ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300">
                  <p className="font-bold mb-1">Server Registered Successfully!</p>
                  <p className="text-gray-300">Run this single one-line command on your Linux server to start the agent:</p>
                </div>
                <pre className="bg-black/60 p-4 rounded-2xl border border-darkBorder text-xs font-mono text-blue-300 overflow-x-auto select-all">
                  {registeredCommand}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(registeredCommand);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  {copiedCmd ? 'Copied to Clipboard!' : 'Copy Shell Command'}
                </button>
                <button
                  onClick={() => { setShowAddModal(false); resetItemForm(); }}
                  className="w-full py-2 bg-darkBorder/40 hover:bg-darkBorder text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-2 bg-[#0b0f19] p-1 rounded-xl border border-darkBorder">
                  <button
                    type="button"
                    onClick={() => setItemType('url')}
                    className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      itemType === 'url' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Website URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType('server')}
                    className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      itemType === 'server' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>Linux Server</span>
                  </button>
                </div>

                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1">Target Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AWS Production Gateway"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1">Cloud Provider</label>
                  <select
                    value={itemCloud}
                    onChange={(e) => setItemCloud(e.target.value as CloudProvider)}
                    className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all"
                  >
                    <option value="aws">Amazon Web Services (AWS)</option>
                    <option value="gcp">Google Cloud Platform (GCP)</option>
                    <option value="azure">Microsoft Azure</option>
                    <option value="digitalocean">DigitalOcean</option>
                    <option value="baremetal">Bare Metal / VPS</option>
                    <option value="other">Other Provider</option>
                  </select>
                </div>

                {itemType === 'url' ? (
                  <div>
                    <label className="block text-gray-400 text-xs font-semibold mb-1">Target URL</label>
                    <input
                      type="url"
                      required
                      placeholder="https://api.yourdomain.com/health"
                      value={itemUrl}
                      onChange={(e) => setItemUrl(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-gray-400 text-xs font-semibold mb-1">Process Services to Track</label>
                    <input
                      type="text"
                      placeholder="nginx, postgresql, redis (comma-separated)"
                      value={itemProcesses}
                      onChange={(e) => setItemProcesses(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
                >
                  {loading ? 'Registering...' : 'Register Target'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-darkCard border border-darkBorder w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-darkBorder mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Account Settings</h3>
                  <p className="text-xs text-gray-400">Manage tenant notification configurations.</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-darkBorder/40 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateWhatsapp} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1">WhatsApp Phone Number</label>
                <input
                  type="text"
                  placeholder="+14155552671"
                  value={whatsappNum}
                  onChange={(e) => setWhatsappNum(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-darkBorder focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all font-mono"
                />
                <p className="text-[11px] text-gray-500 mt-1">Include country code for Twilio delivery.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                Save Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Channel Settings Modal */}
      <ChannelSettingsModal
        isOpen={showChannelModal}
        onClose={() => setShowChannelModal(false)}
        token={token || ''}
      />

      {/* Public Status Page & Badges Modal */}
      <PublicStatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        user={user}
        items={items}
      />

      {/* Compliance Audit Trail Modal */}
      <AuditLogViewer
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        token={token || ''}
      />
    </div>
  );
}
