import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { RefreshCw, Activity, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DeviceDetails() {
  const { id } = useParams();
  const [device, setDevice] = useState<any>(null);
  const [incomeLogs, setIncomeLogs] = useState([]);
  const [scrapeLogs, setScrapeLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const fetchDetails = async () => {
    try {
      const [deviceRes, incomeRes, scrapeRes] = await Promise.all([
        api.get(`/devices/${id}`),
        api.get(`/income/device/${id}`),
        api.get(`/scrape-logs/${id}`)
      ]);
      setDevice(deviceRes.data);
      setIncomeLogs(incomeRes.data.reverse()); // chronological for chart
      setScrapeLogs(scrapeRes.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

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

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;
  if (!device) return <div className="text-slate-400 p-8">Device not found</div>;

  return (
    <div className="space-y-6">
      <div className="glass-panel overflow-hidden sm:rounded-2xl">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-slate-900/30 border-b border-slate-700/50">
          <div>
            <h3 className="text-lg leading-6 font-semibold text-white">
              Device Information
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-400 font-mono">
              {device.name} at {device.location}
            </p>
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${scraping ? 'animate-spin' : ''}`} />
            {scraping ? 'Scraping...' : 'Sync Node'}
          </button>
        </div>
        <div className="px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-slate-700/50">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 hover:bg-slate-800/20 transition-colors">
              <dt className="text-sm font-medium text-slate-400">IP Address</dt>
              <dd className="mt-1 text-sm text-white sm:mt-0 sm:col-span-2 font-mono bg-slate-900 px-2 py-1 rounded inline-block w-fit border border-slate-800">{device.zerotier_ip}</dd>
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
          <h4 className="text-lg font-medium text-white mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-500" /> Daily Income History
          </h4>
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
                    <span className="text-slate-500 text-xs font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300 mt-1">{log.message}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
