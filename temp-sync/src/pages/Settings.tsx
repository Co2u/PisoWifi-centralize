import { useEffect, useState, type FormEvent } from 'react';
import { Settings as SettingsIcon, Clock3, Shield } from 'lucide-react';
import api from '../lib/api';

export default function Settings() {
  const [credentialData, setCredentialData] = useState({
    currentPassword: '',
    newUsername: '',
    newPassword: '',
  });
  const [cronInterval, setCronInterval] = useState('60');
  const [isSavingSync, setIsSavingSync] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then((res) => {
        if (res.data.cron_interval) {
          setCronInterval(res.data.cron_interval);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const handleSaveSyncSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingSync(true);

    try {
      await api.post('/settings', { cron_interval: cronInterval });
      alert('Sync settings updated successfully.');
    } catch (err: any) {
      console.error(err);
      alert('Failed to update sync settings: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingSync(false);
    }
  };

  const handleSaveCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingCredentials(true);

    try {
      await api.put('/auth/credentials', credentialData);
      alert('Credentials updated successfully. Please login again.');
      localStorage.removeItem('token');
      window.location.href = '/login';
    } catch (err: any) {
      console.error(err);
      alert('Failed to update credentials: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingCredentials(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel overflow-hidden sm:rounded-2xl">
        <div className="px-6 py-5 border-b border-slate-700/50 bg-slate-900/30">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <SettingsIcon className="mr-2 h-5 w-5 text-blue-500" />
            Settings
          </h3>
          <p className="mt-1 text-sm text-slate-400">Manage sync timing and admin access.</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSaveSyncSettings} className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-300 flex items-center">
                <Clock3 className="mr-2 h-4 w-4 text-slate-400" />
                Auto Sync Interval
              </h4>
              <p className="mt-1 text-xs text-slate-500">Choose how often the backend scrapes all registered devices.</p>
            </div>
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-slate-300">Cron Interval</label>
              <select
                value={cronInterval}
                onChange={(e) => setCronInterval(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2 text-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm"
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
            </div>
            <div>
              <button
                type="submit"
                disabled={isSavingSync}
                className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none disabled:opacity-50"
              >
                {isSavingSync ? 'Saving...' : 'Save Sync Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="glass-panel overflow-hidden sm:rounded-2xl">
        <div className="px-6 py-5 border-b border-slate-700/50 bg-slate-900/30">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Shield className="mr-2 h-5 w-5 text-blue-500" />
            Admin Credentials
          </h3>
          <p className="mt-1 text-sm text-slate-400">Update the dashboard login used for this app.</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSaveCredentials} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-slate-300">Current Password</label>
              <input
                type="password"
                required
                value={credentialData.currentPassword}
                onChange={(e) => setCredentialData({ ...credentialData, currentPassword: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2 text-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">New Username</label>
              <input
                type="text"
                value={credentialData.newUsername}
                onChange={(e) => setCredentialData({ ...credentialData, newUsername: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2 text-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm"
                placeholder="Leave blank to keep current"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">New Password</label>
              <input
                type="password"
                value={credentialData.newPassword}
                onChange={(e) => setCredentialData({ ...credentialData, newPassword: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2 text-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm"
                placeholder="Leave blank to keep current"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isSavingCredentials}
                className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none disabled:opacity-50"
              >
                {isSavingCredentials ? 'Saving...' : 'Update Credentials'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
