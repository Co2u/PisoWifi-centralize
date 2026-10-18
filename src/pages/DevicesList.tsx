import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { parseUtcSqliteTimestamp } from '../lib/utils';
import { Plus, Trash2, Settings, Wifi, WifiOff, CloudDownload, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function DevicesList() {
  const [devices, setDevices] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showZtModal, setShowZtModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [syncingNodes, setSyncingNodes] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [formData, setFormData] = useState({ name: '', location: '', zerotier_ip: '', username: '', password: '' });
  const [ztFormData, setZtFormData] = useState({ zt_token: '', zt_network_id: '', default_username: 'admin', default_password: '' });

  const fetchDevices = async () => {
    try {
      const res = await api.get('/devices');
      setDevices(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/devices', formData);
      setShowAddModal(false);
      setFormData({ name: '', location: '', zerotier_ip: '', username: '', password: '' });
      fetchDevices();
    } catch (err) {
      console.error(err);
      alert('Failed to add device');
    }
  };

  const handleZtSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      const res = await api.post('/devices/zerotier-sync', ztFormData);
      alert(`Sync Complete! Added: ${res.data.added}, Updated: ${res.data.updated}`);
      setShowZtModal(false);
      fetchDevices();
    } catch (err: any) {
      console.error(err);
      alert('ZeroTier sync failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this device? This will also delete all its logs.')) return;
    try {
      await api.delete(`/devices/${id}`);
      fetchDevices();
    } catch (err) {
      console.error(err);
    }
  };

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      await api.post('/scrape/run');
      alert('Sync Complete!');
      fetchDevices();
    } catch (err) {
      console.error(err);
      alert('Failed to sync nodes');
    }
    setScraping(false);
  };

  const handleScrapeSingle = async (id: number) => {
    setSyncingNodes(prev => ({ ...prev, [id]: true }));
    try {
      await api.post(`/scrape/run/${id}`);
      fetchDevices();
    } catch (err) {
      console.error(err);
      alert('Failed to sync node');
    }
    setSyncingNodes(prev => ({ ...prev, [id]: false }));
  };

  const filteredDevices = devices.filter((d: any) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = d.name?.toLowerCase().includes(query);
    const locMatch = d.location?.toLowerCase().includes(query);
    const ipMatch = d.zerotier_ip?.toLowerCase().includes(query);
    return nameMatch || locMatch || ipMatch;
  });

  const totalOnlineCount = devices.filter((d: any) => d.status === 'online').length;
  const totalOfflineCount = devices.filter((d: any) => d.status !== 'online').length;

  const onlineDevices = filteredDevices.filter((d: any) => d.status === 'online');
  const offlineDevices = filteredDevices.filter((d: any) => d.status !== 'online');

  const renderDeviceRow = (device: any) => {
    const isOnline = device.status === 'online';
    return (
      <li key={device.id} className="hover:bg-slate-800/30 transition-colors">
        <div className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-400 truncate hover:text-blue-300">
                <Link to={`/devices/${device.id}`}>{device.name}</Link>
              </p>
              <div className="ml-2 flex-shrink-0 flex">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="status-dot bg-green-500 online-glow"></span> Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <span className="status-dot bg-red-500 offline-glow"></span> Offline
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
              <div className="sm:flex flex-col">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="flex items-center text-xs text-slate-400 font-mono break-all">
                    {device.location || 'No location set'} &middot; IP: {device.zerotier_ip}
                  </p>
                  {device.active_users !== undefined && isOnline && (
                    <span className="flex items-center bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 text-xs font-mono">
                      Active Users: <span className="font-bold ml-1">{device.active_users}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center text-xs text-slate-500 font-mono gap-3 sm:justify-end">
                <p>
                  Last seen: {device.last_seen ? formatDistanceToNow(parseUtcSqliteTimestamp(device.last_seen), { addSuffix: true }) : 'Never'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center space-x-2 self-end sm:self-auto">
            <button 
              onClick={() => handleScrapeSingle(device.id)} 
              disabled={syncingNodes[device.id]}
              className="p-2 text-slate-400 hover:text-green-400 rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Sync Node"
            >
              <RefreshCw className={`h-5 w-5 ${syncingNodes[device.id] ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => handleDelete(device.id)} className="p-2 text-slate-400 hover:text-red-400 rounded-full hover:bg-slate-800 transition-colors" title="Delete Node">
              <Trash2 className="h-5 w-5" />
            </button>
            <Link to={`/devices/${device.id}`} className="p-2 text-slate-400 hover:text-blue-400 rounded-full hover:bg-slate-800 transition-colors" title="Settings">
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-transparent gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white">Registered Devices</h3>
          <p className="text-slate-400 text-sm">Manage PisoWiFi Nodes</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              import('xlsx').then((XLSX) => {
                const ws = XLSX.utils.json_to_sheet(filteredDevices.map((d: any) => ({ 
                  Name: d.name, 
                  Location: d.location, 
                  IP: d.zerotier_ip, 
                  Status: d.status, 
                  Last_Seen: d.last_seen 
                })));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Devices");
                XLSX.writeFile(wb, `pisowifi_nodes.xlsx`);
              });
            }}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-4 py-2 border border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white focus:outline-none transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button
            onClick={handleScrapeAll}
            disabled={scraping}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-4 py-2 border border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white focus:outline-none disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${scraping ? 'animate-spin' : ''}`} />
            {scraping ? 'Syncing...' : 'Sync All'}
          </button>
          <button
            onClick={() => setShowZtModal(true)}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-4 py-2 border border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white focus:outline-none transition-colors whitespace-nowrap"
          >
            <CloudDownload className="mr-2 h-4 w-4" /> Import ZeroTier
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-colors whitespace-nowrap"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Device
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden sm:rounded-2xl mt-4">
        {/* Header bar */}
        <div className="p-4 sm:p-5 border-b border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/40 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-base">PisoWiFi Nodes Overview</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                {devices.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Status breakdown: <span className="text-emerald-400 font-medium">{totalOnlineCount} Online</span> &bull; <span className="text-rose-400 font-medium">{totalOfflineCount} Offline</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Status Filter Tabs */}
            <div className="inline-flex p-1 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                All ({filteredDevices.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('online')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  statusFilter === 'online'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Online ({onlineDevices.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('offline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  statusFilter === 'offline'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                Offline ({offlineDevices.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-64 relative">
              <input 
                type="text" 
                placeholder="Search name, location, IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 text-sm text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 pl-9 placeholder-slate-500 transition-colors"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Node Content Sections */}
        {devices.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            <WifiOff className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <p className="font-medium text-slate-400">No PisoWiFi devices found</p>
            <p className="text-xs text-slate-500 mt-1">Click "Add Device" or "Import ZeroTier" above to register your nodes.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {/* ONLINE SECTION */}
            {(statusFilter === 'all' || statusFilter === 'online') && (
              <section aria-label="Online Nodes">
                <div className="px-4 py-3 sm:px-6 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="status-dot bg-green-500 online-glow"></span>
                    <h4 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                      Online Nodes
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {onlineDevices.length}
                      </span>
                    </h4>
                  </div>
                  <span className="text-xs text-emerald-400/90 font-medium hidden sm:inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Operational &amp; Reachable
                  </span>
                </div>

                {onlineDevices.length > 0 ? (
                  <ul className="divide-y divide-slate-700/40">
                    {onlineDevices.map(renderDeviceRow)}
                  </ul>
                ) : (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    {searchQuery ? `No online devices match "${searchQuery}".` : 'No nodes are currently online.'}
                  </div>
                )}
              </section>
            )}

            {/* OFFLINE SECTION */}
            {(statusFilter === 'all' || statusFilter === 'offline') && (
              <section aria-label="Offline Nodes">
                <div className="px-4 py-3 sm:px-6 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="status-dot bg-red-500 offline-glow"></span>
                    <h4 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                      Offline Nodes
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        offlineDevices.length > 0 
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {offlineDevices.length}
                      </span>
                    </h4>
                  </div>
                  <span className="text-xs text-rose-400/90 font-medium hidden sm:inline-flex items-center gap-1.5">
                    {offlineDevices.length > 0 ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" /> Requires Attention / Disconnected
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> All systems reachable
                      </>
                    )}
                  </span>
                </div>

                {offlineDevices.length > 0 ? (
                  <ul className="divide-y divide-slate-700/40">
                    {offlineDevices.map(renderDeviceRow)}
                  </ul>
                ) : (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm flex flex-col sm:flex-row items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {searchQuery
                        ? `No offline devices match "${searchQuery}".`
                        : 'Great! All registered PisoWiFi nodes are currently online.'}
                    </span>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setShowAddModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom glass-panel border border-slate-700/50 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleAddDevice}>
                <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-700/50">
                  <h3 className="text-lg leading-6 font-semibold text-white mb-4" id="modal-title">Add New PisoWiFi Device</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Device Name</label>
                      <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" placeholder="Location A PisoWiFi" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Location</label>
                      <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" placeholder="Sari-Sari Store" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">ZeroTier IP / Host</label>
                      <input type="text" required value={formData.zerotier_ip} onChange={e => setFormData({...formData, zerotier_ip: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors font-mono" placeholder="10.147.17.x" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Admin Username</label>
                        <input type="text" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Admin Password</label>
                        <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse bg-slate-900/30">
                  <button type="submit" className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                    Save Device
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-600 shadow-sm px-4 py-2 bg-slate-800 text-base font-medium text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showZtModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setShowZtModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom glass-panel border border-slate-700/50 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleZtSync}>
                <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-700/50">
                  <h3 className="text-lg leading-6 font-semibold text-white mb-4" id="modal-title">Batch Import from ZeroTier</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Central API Token</label>
                      <input type="password" required value={ztFormData.zt_token} onChange={e => setZtFormData({...ztFormData, zt_token: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" placeholder="Enter your ZeroTier Central API Token" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Network ID</label>
                      <input type="text" required value={ztFormData.zt_network_id} onChange={e => setZtFormData({...ztFormData, zt_network_id: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors font-mono" placeholder="16 char Network ID" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Default PisoWiFi Username</label>
                        <input type="text" required value={ztFormData.default_username} onChange={e => setZtFormData({...ztFormData, default_username: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Default PisoWiFi Password</label>
                        <input type="password" required value={ztFormData.default_password} onChange={e => setZtFormData({...ztFormData, default_password: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">This will automatically fetch all authorized devices on your ZeroTier network and add them here. Devices already matching by IP will have their names updated.</p>
                  </div>
                </div>
                <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse bg-slate-900/30">
                  <button type="submit" disabled={isSyncing} className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none disabled:bg-blue-800 disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                    {isSyncing ? 'Syncing...' : 'Start Import'}
                  </button>
                  <button type="button" onClick={() => setShowZtModal(false)} className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-600 shadow-sm px-4 py-2 bg-slate-800 text-base font-medium text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
