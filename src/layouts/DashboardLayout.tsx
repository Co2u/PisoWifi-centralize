import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, LogOut, Wifi } from 'lucide-react';

export default function DashboardLayout() {
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
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
        <div className="p-4 border-t border-slate-800">
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
    </div>
  );
}
