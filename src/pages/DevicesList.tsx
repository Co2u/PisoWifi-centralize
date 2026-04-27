import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Plus, Trash2, Settings, Wifi, WifiOff, CloudDownload } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function DevicesList() {
  const [devices, setDevices] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showZtModal, setShowZtModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-transparent">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white">Registered Devices</h3>
          <p className="text-slate-400 text-sm">Manage PisoWiFi Nodes</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              import('xlsx').then((XLSX) => {
                const ws = XLSX.utils.json_to_sheet(devices.map((d: any) => ({ 
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
            className="inline-flex items-center px-4 py-2 border border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white focus:outline-none transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button
            onClick={() => setShowZtModal(true)}
            className="inline-flex items-center px-4 py-2 border border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white focus:outline-none transition-colors"
          >
            <CloudDownload className="mr-2 h-4 w-4" /> Import ZeroTier
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Device
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden sm:rounded-2xl mt-4">

        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/30">
          <h3 className="font-semibold text-white">PisoWiFi Nodes Overview</h3>
          <span className="text-xs text-slate-400">Manage connections</span>
        </div>
        <ul className="divide-y divide-slate-700/50">
          {devices.map((device: any) => (
            <li key={device.id}>
              <div className="px-4 py-4 sm:px-6 hover:bg-slate-800/30 transition-colors flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-400 truncate hover:text-blue-300">
                      <Link to={`/devices/${device.id}`}>{device.name}</Link>
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      {device.status === 'online' ? (
                        <span className="flex items-center gap-2 text-sm text-slate-300"><span className="status-dot bg-green-500 online-glow"></span> Online</span>
                      ) : (
                        <span className="flex items-center gap-2 text-sm text-slate-300"><span className="status-dot bg-red-500 offline-glow"></span> Offline</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-xs text-slate-400 font-mono">
                        {device.location} &middot; IP: {device.zerotier_ip}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-xs text-slate-500 sm:mt-0 font-mono">
                      <p>
                        Last seen: {device.last_seen ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true }) : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="ml-5 flex-shrink-0 flex items-center space-x-2">
                  <button onClick={() => handleDelete(device.id)} className="p-2 text-slate-500 hover:text-red-400 rounded-full hover:bg-slate-800 transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <Link to={`/devices/${device.id}`} className="p-2 text-slate-500 hover:text-blue-400 rounded-full hover:bg-slate-800 transition-colors">
                    <Settings className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
          {devices.length === 0 && (
            <li className="px-4 py-8 text-center text-slate-500">
              No devices found. Click "Add Device" to get started.
            </li>
          )}
        </ul>
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
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-2 gap-4">
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
