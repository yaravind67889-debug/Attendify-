import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { Users, CalendarCheck, MessageSquare, AlertCircle, BarChart2, Lock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [locked, setLocked] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [submittingLock, setSubmittingLock] = useState(false);
  const [lockMessage, setLockMessage] = useState('');

  const fetchLockStatus = async () => {
    try {
      const res = await api.get('/auth/signup-lock-status');
      setLocked(res.data.locked);
    } catch (err) {
      console.error('Failed to load signup lock status:', err);
    }
  };

  useEffect(() => {
    api.get('/admin/dashboard').then(res => setStats(res.data));
    fetchLockStatus();
  }, []);

  const handleLockToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLock(true);
    setLockMessage('');
    try {
      await api.post('/admin/signup-lock', { password: lockPassword });
      setLockPassword('');
      await fetchLockStatus();
      setLockMessage(lockPassword.trim() ? 'Signup lock enabled successfully' : 'Signup lock disabled successfully');
      setTimeout(() => setLockMessage(''), 4000);
    } catch (err: any) {
      setLockMessage(err.response?.data?.error || 'Failed to update signup lock');
    } finally {
      setSubmittingLock(false);
    }
  };

  if (!stats) return <Layout role="admin"><div className="animate-pulse">Loading dashboard...</div></Layout>;

  const totalToday = stats.presentToday + stats.absentToday;
  const attendanceRate = totalToday > 0 ? Math.round((stats.presentToday / totalToday) * 100) : 0;

  const chartData = [
    { name: 'Present', value: stats.presentToday, fill: '#10b981' }, // emerald-500
    { name: 'Absent', value: stats.absentToday, fill: '#ef4444' }   // red-500
  ];

  return (
    <Layout role="admin">
      <div className="space-y-6">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stat 1 */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 flex flex-col justify-between shadow-sm h-36">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Students</span>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-4xl font-extrabold text-slate-900">{stats.totalStudents}</span>
            </div>
          </div>
          
          {/* Stat 2 */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 flex flex-col justify-between shadow-sm h-36">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Today</span>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-4xl font-extrabold text-slate-900">{stats.presentToday}</span>
              <span className="text-xs font-semibold text-slate-400">/{stats.totalStudents} total</span>
            </div>
          </div>
          
          {/* Stat 3 */}
          <div className="bg-indigo-600 p-5 rounded-[2rem] text-white flex flex-col justify-between shadow-lg shadow-indigo-200 h-36">
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Avg Attendance</span>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-4xl font-extrabold">{attendanceRate}%</span>
            </div>
          </div>

          {/* Stat 4 */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 flex flex-col justify-between shadow-sm h-36">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Queries</span>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-4xl font-extrabold text-slate-900">
                {stats.pendingQueries < 10 && stats.pendingQueries > 0 ? `0${stats.pendingQueries}` : stats.pendingQueries}
              </span>
              {stats.pendingQueries > 0 && (
                <span className="text-xs font-semibold text-rose-500 animate-pulse">Action Req.</span>
              )}
            </div>
          </div>
        </div>

        {/* Charts & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg mb-6">Today's Overview</h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-[#1E293B] p-6 lg:p-8 rounded-[2.5rem] shadow-xl flex flex-col text-white">
            <h3 className="font-bold text-xl mb-2">Administrative Tasks</h3>
            <p className="text-slate-400 text-sm mb-6">Quickly manage daily operations and student records.</p>
            
            <div className="grid grid-cols-2 gap-3 mt-auto">
              <a href="/admin/attendance" className="bg-indigo-500 hover:bg-indigo-400 rounded-[1.5rem] py-5 px-2 flex flex-col items-center justify-center gap-2 transition-all">
                <CalendarCheck className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">Attendance</span>
              </a>
              <a href="/admin/students" className="bg-slate-700 hover:bg-slate-600 rounded-[1.5rem] py-5 px-2 flex flex-col items-center justify-center gap-2 transition-all">
                <Users className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">Students</span>
              </a>
              <a href="/admin/requests" className="bg-slate-700 hover:bg-slate-600 rounded-[1.5rem] py-5 px-2 flex flex-col items-center justify-center gap-2 transition-all relative">
                <MessageSquare className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">Requests</span>
                {stats.pendingQueries > 0 && (
                  <span className="absolute top-4 right-4 bg-rose-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shadow-lg">
                    {stats.pendingQueries}
                  </span>
                )}
              </a>
              <a href="/admin/reports" className="bg-indigo-600 hover:bg-indigo-500 rounded-[1.5rem] py-5 px-2 flex flex-col items-center justify-center gap-2 transition-all">
                <BarChart2 className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">Reports</span>
              </a>
            </div>
          </div>
        </div>

        {/* Signup Lock Settings */}
        <div className="bg-white p-6 lg:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl shrink-0 ${locked ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">Signup Control (Student Sign Up Page)</h3>
                <p className="text-xs text-slate-400 font-medium">
                  {locked 
                    ? 'Registration is currently locked. New students require the passcode to sign up.' 
                    : 'Registration is currently open. New students can register without a passcode.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${locked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {locked ? 'Locked with Password' : 'Open Registration'}
              </span>
            </div>
          </div>

          <form onSubmit={handleLockToggle} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mt-6 pt-6 border-t border-slate-100">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                {locked ? 'Update Passcode or Clear Passcode to Unlock' : 'Set Registration Lock Passcode'}
              </label>
              <input
                type="text"
                value={lockPassword}
                onChange={(e) => setLockPassword(e.target.value)}
                placeholder={locked ? 'Leave empty and click button to remove lock' : 'Enter passcode to lock student sign up'}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={submittingLock}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  locked && !lockPassword
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100'
                }`}
              >
                {submittingLock ? 'Saving...' : (locked && !lockPassword ? 'Remove Lock' : (locked ? 'Update Lock Password' : 'Activate Lock'))}
              </button>
            </div>
          </form>
          {lockMessage && (
            <p className="text-xs font-bold text-indigo-600 mt-3 animate-pulse">{lockMessage}</p>
          )}
        </div>

      </div>
    </Layout>
  );
}
