import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  MessageSquare, 
  Bell, 
  LogOut,
  Menu,
  X,
  ShieldAlert,
  BookOpen,
  BarChart2
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { safeStorage } from '../lib/storage';

interface LayoutProps {
  children: React.ReactNode;
  role: 'admin' | 'student';
}

export default function Layout({ children, role }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = safeStorage.getItem('token');
    const userRole = safeStorage.getItem('role');
    if (!token || userRole !== role) {
      navigate('/');
    }
  }, [navigate, role]);

  const adminLinks = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Subjects', path: '/admin/subjects', icon: BookOpen },
    { name: 'Students', path: '/admin/students', icon: Users },
    { name: 'Attendance', path: '/admin/attendance', icon: CalendarCheck },
    { name: 'Requests', path: '/admin/requests', icon: MessageSquare },
    { name: 'Notices', path: '/admin/notices', icon: Bell },
    { name: 'Reports', path: '/admin/reports', icon: BarChart2 },
  ];

  const studentLinks = [
    { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
  ];

  const links = role === 'admin' ? adminLinks : studentLinks;

  const handleLogout = () => {
    safeStorage.clear();
    navigate('/');
  };

  const handleAdminAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    try {
      const { data } = await api.post('/auth/admin/direct-login', { password: adminPassword });
      safeStorage.setItem('token', data.token);
      safeStorage.setItem('role', 'admin');
      navigate('/admin/dashboard');
      setShowAdminPrompt(false);
    } catch (err) {
      setAdminError('Invalid password');
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex font-sans text-slate-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-[#0F172A] text-white flex flex-col transition-transform z-50",
        "lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center gap-3 justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-lg italic text-white">CSE</div>
            <span className="font-bold tracking-tight text-xl text-slate-100">Attendify</span>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
                  isActive 
                    ? "bg-indigo-600 text-white" 
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5 opacity-80" />
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800 flex flex-col gap-4">
          {role === 'student' && (
            <button 
              onClick={() => setShowAdminPrompt(true)}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors uppercase tracking-wider"
            >
              <ShieldAlert className="w-4 h-4" />
              Admin Access
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 text-white font-medium">
              {role === 'admin' ? 'AD' : 'ST'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold truncate text-white">
                {role === 'admin' ? 'Administrator' : JSON.parse(safeStorage.getItem('student') || '{}').name}
              </p>
              <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-bold uppercase tracking-wider">Sign Out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 lg:p-8 flex flex-col gap-6">
        <header className="flex items-center gap-4">
          <button 
            className="lg:hidden text-slate-600 hover:text-slate-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            {links.find(l => location.pathname.startsWith(l.path))?.name || 'Dashboard'}
          </h1>
        </header>

        <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Admin Access Modal */}
      {showAdminPrompt && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Admin Authentication</h3>
            <p className="text-sm text-slate-500 mb-4 font-medium">Enter master password to access the admin portal.</p>
            <form onSubmit={handleAdminAccess}>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none mb-4 font-medium"
              />
              {adminError && <p className="text-xs text-rose-500 font-bold mb-4">{adminError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdminPrompt(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Login</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
