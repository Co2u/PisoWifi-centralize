import { useState, useEffect, type FormEvent } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, LogOut, Settings } from 'lucide-react';
import api from '../lib/api';

export default function DashboardLayout() {
  const location = useLocation();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [credentialData, setCredentialData] = useState({ currentPassword: '', newUsername: '', newPassword: '' });
  const [cronInterval, setCronInterval] = useState('60');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (showSettingsModal) {
      api.get('/settings').then(res => {
        if (res.data.cron_interval) setCronInterval(res.data.cron_interval);
      }).catch(err => console.error(err));
    }
  }, [showSettingsModal]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleUpdateCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      if (credentialData.currentPassword) {
         await api.put('/auth/credentials', credentialData);
         alert('Credentials updated successfully. Please login again.');
         handleLogout();
         return;
      }
      
      await api.post('/settings', { cron_interval: cronInterval });
      alert('Settings updated successfully.');
      setShowSettingsModal(false);
    } catch (err: any) {
      alert('Failed to update settings: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUpdating(false);
    }
  };

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Devices', path: '/devices', icon: Server },
  ];

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 flex-shrink-0 flex flex-col border-r border-slate-800">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white mb-0">P</div>
          <h1 className="text-xl font-bold tracking-tight text-white">PisoWiFi Central</h1>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-blue-500' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-1">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex w-full items-center px-3 py-2 text-sm font-medium text-slate-400 rounded-md hover:text-white"
          >
            <Settings className="mr-3 text-slate-500 h-5 w-5 hover:text-white" />
            Admin Settings
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-3 py-2 text-sm font-medium text-slate-400 rounded-md hover:text-white"
          >
            <LogOut className="mr-3 text-slate-500 h-5 w-5 hover:text-white" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto custom-scroll">
        <header className="h-16 flex justify-between items-center px-8 mb-4 border-b border-slate-800">
          <h2 className="text-xl font-bold tracking-tight text-white capitalize">
            {location.pathname === '/' ? 'PISOFi Centralized Monitoring' : location.pathname.split('/')[1]}
          </h2>
        </header>
        <div className="px-8 pb-8">
          <Outlet />
        </div>
      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setShowSettingsModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom glass-panel border border-slate-700/50 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdateCredentials}>
                <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-700/50">
                  <h3 className="text-lg leading-6 font-semibold text-white mb-4" id="modal-title">Admin Account Settings</h3>
                  <div className="space-y-4">
                    <div className="pb-4 border-b border-slate-700/30">
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Sync Configuration</h4>
                      <label className="block text-sm font-medium text-slate-300">Custom Cron Intervals</label>
                      <select 
                        value={cronInterval}
                        onChange={e => setCronInterval(e.target.value)}
                        className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                      >
                        <option value="5">Every 5 minutes</option>
                        <option value="15">Every 15 minutes</option>
                        <option value="30">Every 30 minutes</option>
                        <option value="60">Every 1 hour</option>
                        <option value="120">Every 2 hours</option>
                        <option value="360">Every 6 hours</option>
                        <option value="720">Every 12 hours</option>
                        <option value="1440">Every 24 hours</option>
                      </select>
                      <p className="mt-1 text-xs text-slate-500">Adjust how often the backend auto-syncs the nodes.</p>
                    </div>

                    <h4 className="text-sm font-medium text-slate-400 mb-1 pt-2">Security</h4>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Current Password (Required for changing login details)</label>
                      <input type="password" value={credentialData.currentPassword} onChange={e => setCredentialData({...credentialData, currentPassword: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">New Username (leave blank to keep current)</label>
                      <input type="text" value={credentialData.newUsername} onChange={e => setCredentialData({...credentialData, newUsername: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">New Password (leave blank to keep current)</label>
                      <input type="password" value={credentialData.newPassword} onChange={e => setCredentialData({...credentialData, newPassword: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse bg-slate-900/30">
                  <button type="submit" disabled={isUpdating} className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none disabled:bg-blue-800 disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setShowSettingsModal(false)} className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-600 shadow-sm px-4 py-2 bg-slate-800 text-base font-medium text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
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
