import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { UserCircle, ArrowRight, UserPlus, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { safeStorage } from '../lib/storage';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [pin, setPin] = useState('');
  
  // Signup fields
  const [department, setDepartment] = useState('CSE');
  const [semester, setSemester] = useState(1);
  
  // Signup lock fields
  const [signupLocked, setSignupLocked] = useState(false);
  const [signupPassword, setSignupPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if signup is locked on mount or when switching tabs
    api.get('/auth/signup-lock-status')
      .then(res => {
        setSignupLocked(res.data.locked);
      })
      .catch(err => {
        console.error('Failed to fetch signup lock status:', err);
      });
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { data } = await api.post('/auth/student/login', { pin });
        safeStorage.setItem('token', data.token);
        safeStorage.setItem('role', 'student');
        safeStorage.setItem('student', JSON.stringify(data.student));
        navigate('/student/dashboard');
      } else {
        const { data } = await api.post('/auth/student/signup', {
          pin, name: '', rollNumber: '', regNumber: '', semester, department, signupPassword
        });
        safeStorage.setItem('token', data.token);
        safeStorage.setItem('role', 'student');
        safeStorage.setItem('student', JSON.stringify(data.student));
        navigate('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || (isLogin ? 'Login failed.' : 'Signup failed. PIN may already exist.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] px-4 font-sans text-slate-900 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-200">
          <div className="px-8 pt-12 pb-10 text-center bg-[#0F172A] text-white">
            <div className="w-16 h-16 bg-indigo-500 rounded-[1.5rem] flex items-center justify-center font-bold text-3xl italic text-white mx-auto mb-6 shadow-lg shadow-indigo-500/50">
              CSE
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Attendify</h1>
            <p className="text-slate-400 mt-2 text-sm font-medium">Diploma College Attendance System</p>
          </div>
          
          <div className="p-8">
            <div className="flex rounded-[1.5rem] bg-slate-100 p-1.5 mb-8">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-[1.25rem] transition-colors",
                  isLogin ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <UserCircle className="w-4 h-4" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-[1.25rem] transition-colors",
                  !isLogin ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <UserPlus className="w-4 h-4" />
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-2xl border border-rose-100">
                  {error}
                </div>
              )}

              {isLogin ? (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    PIN Number
                  </label>
                  <input
                    type="text"
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="e.g. 25005-CS-052"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium"
                  />
                  <p className="text-xs text-slate-400 mt-3 font-medium">Enter your designated College PIN to access your dashboard.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">PIN Number</label>
                    <input type="text" required value={pin} onChange={(e) => setPin(e.target.value)} placeholder="e.g. 25005-CS-052" className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Branch / Department</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none transition-all font-medium bg-white"
                    >
                      <option value="CSE">CSE (Computer Science & Engineering)</option>
                      <option value="ME">ME (Mechanical Engineering)</option>
                      <option value="CE">CE (Civil Engineering)</option>
                      <option value="ECE">ECE (Electronics & Communication)</option>
                      <option value="EE">EE (Electrical Engineering)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Semester</label>
                    <input type="number" min="1" max="6" required value={semester} onChange={(e) => setSemester(Number(e.target.value))} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none transition-all font-medium" />
                  </div>
                  {signupLocked && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                      <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wide">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        Registration Lock Active
                      </div>
                      <p className="text-[11px] text-amber-700 font-medium">An administrator has locked open registration. Enter the authorized signup passcode below to complete your registration.</p>
                      <input
                        type="password"
                        required
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Authorized signup passcode"
                        className="w-full px-3 py-2 bg-white text-slate-800 rounded-xl border border-amber-200 focus:border-amber-500 outline-none transition-all text-xs font-bold"
                      />
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-6 shadow-md shadow-indigo-200"
              >
                {loading ? (isLogin ? 'Authenticating...' : 'Registering...') : (isLogin ? 'Sign In' : 'Sign Up')}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
