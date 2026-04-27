import { useState, useEffect } from 'react';
import api from '../lib/api';
import { RefreshCw, DollarSign, Server, ServerOff } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Overview() {
  const [stats, setStats] = useState({ incomeToday: 0, incomeAllTime: 0, onlineDevices: 0, offlineDevices: 0 });
  const [chartData, setChartData] = useState([]);
  const [todayIncomeLogs, setTodayIncomeLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, chartRes, todayRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/chart'),
        api.get('/income/today')
      ]);
      setStats(statsRes.data);
      setChartData(chartRes.data);
      setTodayIncomeLogs(todayRes.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      await api.post('/scrape/run');
      await fetchData();
    } catch (err) {
      console.error(err);
    }
    setScraping(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-transparent">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-white">Dashboard Summary</h3>
          <p className="text-slate-400 text-sm">System Overview & Analytics</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-2">
            <span className="status-dot bg-green-500 online-glow animate-pulse"></span>
            Sync Active
          </div>
          <button
            onClick={handleScrapeAll}
            disabled={scraping}
            className="flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${scraping ? 'animate-spin' : ''}`} />
            {scraping ? 'Scraping...' : 'Manual Scrape Now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Income Today */}
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Income Today</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white font-mono">₱{stats.incomeToday.toFixed(2)}</span>
          </div>
        </div>

        {/* Income All Time */}
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Income (All Time)</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white font-mono">₱{stats.incomeAllTime.toFixed(2)}</span>
          </div>
        </div>

        {/* Online Devices */}
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Online Devices</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white font-mono">{stats.onlineDevices}</span>
            <span className="text-green-400 text-xs mb-1 font-medium">Active</span>
          </div>
        </div>

        {/* Offline Devices */}
        <div className="glass-panel rounded-2xl p-5 border-l-4 border-blue-500">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Offline Devices</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white font-mono">{stats.offlineDevices}</span>
            {stats.offlineDevices > 0 && <span className="text-red-400 text-xs mb-1 font-medium">Needs Attention</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <h4 className="text-lg font-medium text-white mb-4">Last 7 Days Revenue</h4>
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.9)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value: number) => [`₱${value}`, 'Income']}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Devices Today */}
        <div className="glass-panel rounded-2xl p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/30">
            <h4 className="font-semibold text-white">Today's Collections</h4>
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll p-4">
            {todayIncomeLogs.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-10">No data collected today yet.</p>
            ) : (
              <ul className="divide-y divide-slate-700/50">
                {todayIncomeLogs.map((log: any) => (
                  <li key={log.device_id} className="py-3 flex justify-between items-center hover:bg-slate-800/30 transition-colors px-2 -mx-2 rounded">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{log.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{log.location}</p>
                    </div>
                    <span className="inline-flex items-center text-sm font-semibold text-blue-400 font-mono">
                      ₱{log.amount?.toFixed(2) || '0.00'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
