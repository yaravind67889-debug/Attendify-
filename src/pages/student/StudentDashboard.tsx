import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { CalendarCheck, AlertCircle, Send, CheckCircle, Bell, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as PieTooltip } from 'recharts';

export default function StudentDashboard() {
  const [data, setData] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqForm, setReqForm] = useState({ date: '', subject: '', message: '' });
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toLocaleDateString('en-CA');
  });

  const adjustDate = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  };

  const setToday = () => {
    setSelectedDate(new Date().toLocaleDateString('en-CA'));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, reqRes, notRes] = await Promise.all([
        api.get('/student/dashboard'),
        api.get('/student/requests'),
        api.get('/notices')
      ]);
      setData(dashRes.data);
      if (reqRes && Array.isArray(reqRes.data)) {
        setRequests([...reqRes.data].sort((a: any, b: any) => b.id - a.id));
      } else {
        setRequests([]);
      }
      if (notRes && Array.isArray(notRes.data)) {
        setNotices([...notRes.data].sort((a: any, b: any) => b.id - a.id));
      } else {
        setNotices([]);
      }
    } catch (err) {
      console.error('Failed to fetch student dashboard data:', err);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/student/requests', reqForm);
      setShowRequestForm(false);
      setReqForm({ date: '', subject: '', message: '' });
      fetchData();
      alert('Request submitted successfully');
    } catch (err) {
      alert('Failed to submit request');
    }
  };

  if (!data) return <Layout role="student"><div className="animate-pulse">Loading dashboard...</div></Layout>;

  const pieData = [
    { name: 'Present', value: data.present, color: '#10b981' },
    { name: 'Absent', value: data.absent, color: '#ef4444' },
    { name: 'Leave', value: data.leave, color: '#f97316' },
  ];

  return (
    <Layout role="student">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Summary & Charts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 lg:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8">
            <div className="w-48 h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <PieTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-slate-900">{data.percentage}%</span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4 w-full">
              <div className="p-4 bg-emerald-50 rounded-[1.5rem] border border-emerald-100 flex flex-col justify-between">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">Present</p>
                <p className="text-3xl font-extrabold text-emerald-600">{data.present}</p>
              </div>
              <div className="p-4 bg-rose-50 rounded-[1.5rem] border border-rose-100 flex flex-col justify-between">
                <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2">Absent</p>
                <p className="text-3xl font-extrabold text-rose-600">{data.absent}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-[1.5rem] border border-orange-100 flex flex-col justify-between">
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-2">Leave</p>
                <p className="text-3xl font-extrabold text-orange-600">{data.leave}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-200 flex flex-col justify-between">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Total Days</p>
                <p className="text-3xl font-extrabold text-slate-600">{data.present + data.absent + data.leave}</p>
              </div>
            </div>
          </div>

          {/* Daily Subject-Wise Attendance Card */}
          <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Daily Subject-Wise Attendance</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Track your class attendance for individual subjects day by day</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-auto">
                <button 
                  onClick={() => adjustDate(-1)} 
                  className="p-1.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-600 transition"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 px-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                    className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  />
                </div>
                <button 
                  onClick={() => adjustDate(1)} 
                  className="p-1.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-600 transition"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {selectedDate !== new Date().toLocaleDateString('en-CA') && (
                  <button 
                    onClick={setToday}
                    className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-xl hover:bg-indigo-100 transition ml-1"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.subjects && data.subjects.length > 0 ? (
                data.subjects.map((subj: any) => {
                  const record = data.attendance.find(
                    (a: any) => a.date === selectedDate && a.subject.toLowerCase() === subj.name.toLowerCase()
                  );
                  
                  return (
                    <div 
                      key={subj.id} 
                      className={cn(
                        "p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between",
                        record?.status === 'present' ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50" :
                        record?.status === 'absent' ? "bg-rose-50/50 border-rose-100 hover:bg-rose-50" :
                        record?.status === 'leave' ? "bg-orange-50/50 border-orange-100 hover:bg-orange-50" :
                        "bg-slate-50/50 border-slate-200/60 hover:bg-slate-50"
                      )}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{subj.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Semester {subj.semester}</p>
                      </div>
                      <div>
                        {record ? (
                          <span className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5",
                            record.status === 'present' ? "bg-emerald-500 text-white" :
                            record.status === 'absent' ? "bg-rose-500 text-white" :
                            "bg-orange-500 text-white"
                          )}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {record.status}
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-400 bg-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            Not Marked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-sm font-medium">
                  No subjects registered for your semester. Contact administrator to assign subjects.
                </div>
              )}
            </div>
            
            {/* Short daily status report */}
            {data.subjects && data.subjects.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-4">
                  <span>
                    Present: <strong className="text-emerald-600 font-bold">{data.attendance.filter((a: any) => a.date === selectedDate && a.status === 'present').length}</strong>
                  </span>
                  <span>
                    Absent: <strong className="text-rose-600 font-bold">{data.attendance.filter((a: any) => a.date === selectedDate && a.status === 'absent').length}</strong>
                  </span>
                  <span>
                    Leave: <strong className="text-orange-600 font-bold">{data.attendance.filter((a: any) => a.date === selectedDate && a.status === 'leave').length}</strong>
                  </span>
                </div>
                <div>
                  Date: <strong className="text-slate-700 font-semibold">{new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Pending Corrections</h3>
              <button 
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Raise Issue →
              </button>
            </div>

            {showRequestForm && (
              <div className="p-5 mb-6 rounded-[1.5rem] border border-slate-200 bg-slate-50">
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
                      <input required type="text" value={reqForm.subject} onChange={e => setReqForm({...reqForm, subject: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" placeholder="e.g. Data Structures Class" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Date</label>
                      <input required type="date" value={reqForm.date} onChange={e => setReqForm({...reqForm, date: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Message</label>
                    <textarea required value={reqForm.message} onChange={e => setReqForm({...reqForm, message: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm h-24" placeholder="Explain the issue..."></textarea>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" onClick={() => setShowRequestForm(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"><Send className="w-4 h-4"/> Submit</button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {requests.map(req => (
                <div key={req.id} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{req.subject}</h4>
                      <p className="text-[10px] text-slate-500 uppercase font-semibold">{req.date}</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                      req.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      req.status === 'approved' ? "bg-emerald-100 text-emerald-700" :
                      "bg-rose-100 text-rose-700"
                    )}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{req.message}</p>
                  {req.adminReply && (
                    <div className="bg-slate-100 p-3 mt-1 text-xs rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">Admin: </span>{req.adminReply}
                    </div>
                  )}
                </div>
              ))}
              {requests.length === 0 && <div className="py-6 text-center text-sm font-medium text-slate-400">No requests raised.</div>}
            </div>
          </div>
        </div>

        {/* Right Column: Notices & Info */}
        <div className="space-y-6">
          <div className="bg-indigo-600 text-white p-6 rounded-[2.5rem] shadow-lg shadow-indigo-200">
            <h3 className="font-bold text-lg mb-6 text-indigo-100 uppercase tracking-wider text-sm">My Profile</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-indigo-500/50 pb-2">
                <span className="text-indigo-200 font-semibold">PIN</span>
                <span className="font-bold">{data?.student?.pin || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-indigo-500/50 pb-2">
                <span className="text-indigo-200 font-semibold">Department</span>
                <span className="font-bold uppercase">{data?.student?.department || 'CSE'}</span>
              </div>
              <div className="flex justify-between border-b border-indigo-500/50 pb-2">
                <span className="text-indigo-200 font-semibold">Class</span>
                <span className="font-bold">Sem {data?.student?.semester || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <h3 className="font-bold text-sm mb-4 uppercase text-slate-400 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Latest Notices
            </h3>
            <div className="flex-1 space-y-4 max-h-96 overflow-y-auto">
              {notices.map((notice, i) => (
                <div key={notice.id} className={cn("pl-3 border-l-2", i === 0 ? "border-indigo-500" : "border-slate-200")}>
                  <p className="text-xs font-bold text-slate-900">{notice.title}</p>
                  <p className="text-[10px] text-slate-500 font-semibold mb-1">{notice.date}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{notice.content}</p>
                </div>
              ))}
              {notices.length === 0 && <div className="py-4 text-center text-sm font-medium text-slate-400">No recent notices.</div>}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
