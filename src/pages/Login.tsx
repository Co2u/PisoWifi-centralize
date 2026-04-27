import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Wifi } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center flex-col items-center gap-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-3xl text-white shadow-lg shadow-blue-600/20">P</div>
          <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
            PisoWiFi Central
          </h2>
        </div>
        <p className="mt-2 text-center text-sm text-slate-400">
          Sign in to the dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-4 rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-300">Username</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900/50 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900/50 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/20 rounded p-2 text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 transition-colors"
              >
                Sign in
              </button>
            </div>
            <p className="text-xs text-center text-slate-500 mt-4">
              Default login: admin / admin
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
