import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { formatUtcSqliteTimestamp } from '../lib/utils';
import { RefreshCw, Activity, Calendar, Edit } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DeviceDetails() {
  const { id } = useParams();
  const [device, setDevice] = useState<any>(null);
  const [incomeLogs, setIncomeLogs] = useState([]);
  const [scrapeLogs, setScrapeLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', location: '', zerotier_ip: '', username: '', password: '' });
  const [chartDays, setChartDays] = useState<number | 'custom'>(30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDetails = async () => {
    try {
      let chartUrl = `/income/device/${id}?days=${chartDays}`;
      if (chartDays === 'custom' && startDate && endDate) {
        chartUrl = `/income/device/${id}?startDate=${startDate}&endDate=${endDate}`;
      } else if (chartDays === 'custom') {
        chartUrl = `/income/device/${id}?days=30`;
      }

      const [deviceRes, incomeRes, scrapeRes] = await Promise.all([
        api.get(`/devices/${id}`),
        api.get(chartUrl),
        api.get(`/scrape-logs/${id}`)
      ]);
      setDevice(deviceRes.data);
      setEditFormData({
        name: deviceRes.data.name || '',
        location: deviceRes.data.location || '',
        zerotier_ip: deviceRes.data.zerotier_ip || '',
        username: deviceRes.data.username || '',
        password: '' // Don't populate password
      });
      setIncomeLogs(incomeRes.data.reverse()); // chronological for chart
      setScrapeLogs(scrapeRes.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (chartDays === 'custom') {
      if (startDate && endDate) {
        fetchDetails();
      }
    } else {
      fetchDetails();
    }
  }, [id, chartDays, startDate, endDate]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      await api.post(`/scrape/run/${id}`);
      await fetchDetails();
    } catch (err) {
      console.error(err);
    }
    setScraping(false);
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put(`/devices/${id}`, editFormData);
      setShowEditModal(false);
      await fetchDetails();
    } catch (err: any) {
      console.error(err);
      alert('Failed to update device: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;
  if (!device) return <div className="text-slate-400 p-8">Device not found</div>;

  return (
    <div className="space-y-6">
      <div className="glass-panel overflow-hidden sm:rounded-2xl">
        <div className="px-4 py-5 sm:px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/30 border-b border-slate-700/50 gap-4">
          <div>
            <h3 className="text-lg leading-6 font-semibold text-white">
              Device Information
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-400 font-mono">
              {device.name} at {device.location}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex-1 sm:flex-none justify-center inline-flex items-center px-4 py-2 border border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Edit className="mr-2 h-4 w-4" /> Edit
            </button>
            <button
              onClick={handleScrape}
              disabled={scraping}
              className="flex-1 sm:flex-none justify-center inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'Scraping...' : 'Sync Node'}
            </button>
          </div>
        </div>
        <div className="px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-slate-700/50">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-slate-800/20 transition-colors">
              <dt className="text-sm font-medium text-slate-400">IP Address</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 font-mono bg-slate-900 px-2 py-1 rounded inline-block w-fit border border-slate-800">{device.zerotier_ip}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-slate-800/20 transition-colors">
              <dt className="text-sm font-medium text-slate-400">Username</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 font-mono">{device.username}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-slate-800/20 transition-colors">
              <dt className="text-sm font-medium text-slate-400">Status</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2">
                {device.status === 'online' ? (
                  <span className="flex items-center gap-2 text-sm text-slate-300 w-fit"><span className="status-dot bg-green-500 online-glow"></span> Online</span>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-slate-300 w-fit"><span className="status-dot bg-red-500 offline-glow"></span> Offline</span>
                )}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-slate-800/20 transition-colors">
              <dt className="text-sm font-medium text-slate-400">Total Recorded Income</dt>
              <dd className="mt-1 text-sm text-blue-400 sm:mt-0 sm:col-span-2 font-bold font-mono">
                ₱{incomeLogs.reduce((acc: number, curr: any) => acc + curr.amount, 0).toFixed(2)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel sm:rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h4 className="text-lg font-medium text-white flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-500" /> Daily Income History
            </h4>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  import('xlsx').then((XLSX) => {
                    const ws = XLSX.utils.json_to_sheet(incomeLogs.map((log: any) => ({ Date: log.date, Amount: log.amount })));
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Income Logs");
                    const filename = chartDays === 'custom' ? `${device.name.replace(/\s+/g, '_')}_income_${startDate}_to_${endDate}.xlsx` : `${device.name.replace(/\s+/g, '_')}_income_${chartDays}_days.xlsx`;
                    XLSX.writeFile(wb, filename);
                  });
                }}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 rounded-lg px-3 py-2 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {chartDays === 'custom' && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)}
                      className="flex-1 min-w-[120px] bg-slate-800 border border-slate-700 text-sm text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 transition-colors"
                    />
                    <span className="text-slate-400 self-center">to</span>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)}
                      className="flex-1 min-w-[120px] bg-slate-800 border border-slate-700 text-sm text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 transition-colors"
                    />
                  </div>
                )}
                <select
                  value={chartDays}
                  onChange={(e) => setChartDays(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
                  className="flex-1 sm:flex-none min-w-[140px] bg-slate-800 border border-slate-700 text-sm text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 transition-colors"
                >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value={365}>Last 1 Year</option>
                <option value="custom">Custom Range</option>
              </select>
              </div>
            </div>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeLogs} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.9)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value: number) => [`₱${value}`, 'Income']} 
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel sm:rounded-2xl overflow-hidden flex flex-col max-h-[22rem]">
          <h4 className="px-6 py-4 border-b border-slate-700/50 text-lg font-medium text-white flex items-center bg-slate-900/30">
            <Calendar className="h-5 w-5 mr-2 text-slate-400" /> System Logs
          </h4>
          <div className="flex-1 overflow-y-auto px-6 py-4 custom-scroll">
            <ul className="space-y-4">
              {scrapeLogs.map((log: any) => (
                <li key={log.id} className="text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-mono text-xs px-2 py-0.5 rounded ${log.status === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {log.status.toUpperCase()}
                    </span>
                    <span className="text-slate-500 text-xs font-mono">{formatUtcSqliteTimestamp(log.timestamp)}</span>
                  </div>
                  <p className="text-slate-300 mt-1">{log.message}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setShowEditModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom glass-panel border border-slate-700/50 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleEditSubmit}>
                <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-700/50">
                  <h3 className="text-lg leading-6 font-semibold text-white mb-4" id="modal-title">Edit Device Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Device Name</label>
                      <input type="text" required value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Location</label>
                      <input type="text" value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">IP Address / URL</label>
                      <input type="text" required value={editFormData.zerotier_ip} onChange={e => setEditFormData({...editFormData, zerotier_ip: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors font-mono" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Admin Username</label>
                      <input type="text" required value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Admin Password (leave blank to keep current)</label>
                      <input type="password" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} className="mt-1 block w-full rounded-lg border-slate-700 bg-slate-900/50 text-white placeholder-slate-500 border p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors" />
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse bg-slate-900/30">
                  <button type="submit" disabled={isSaving} className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none disabled:bg-blue-800 disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setShowEditModal(false)} className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-600 shadow-sm px-4 py-2 bg-slate-800 text-base font-medium text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
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

