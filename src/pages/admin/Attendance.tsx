import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { format } from 'date-fns';
import { Check, X, Minus, Save } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Attendance() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [semester, setSemester] = useState('1');
  const [department, setDepartment] = useState('CSE');
  const [subject, setSubject] = useState('');
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const { data } = await api.get('/admin/subjects');
      setAllSubjects(data);
    } catch (error) {
      console.error('Failed to load subjects');
    }
  };

  const availableSubjects = allSubjects.filter(s => 
    s.semester === Number(semester) && 
    (!s.department || s.department.toUpperCase() === department.toUpperCase())
  );

  // Auto-select first subject if available
  useEffect(() => {
    const matching = allSubjects.filter(s => 
      s.semester === Number(semester) && 
      (!s.department || s.department.toUpperCase() === department.toUpperCase())
    );
    if (matching.length > 0) {
      if (!matching.some(s => s.name === subject)) {
        setSubject(matching[0].name);
      }
    } else {
      setSubject('');
    }
  }, [semester, department, allSubjects, subject]);

  const fetchAttendance = async () => {
    if (!subject) {
      alert('Please select a subject first');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/admin/attendance', {
        params: { date, semester, subject, department }
      });
      // Filter students by semester and department
      const targetStudents = data.students.filter((s: any) => 
        s.semester === Number(semester) && 
        (!department || s.department?.toUpperCase() === department.toUpperCase())
      );
      setStudents(targetStudents);
      
      const newRecords: Record<number, string> = {};
      targetStudents.forEach((s: any) => {
        const existing = data.attendance.find((a: any) => a.studentId === s.id);
        newRecords[s.id] = existing ? existing.status : 'present'; // Default present
      });
      setRecords(newRecords);
    } catch (err) {
      alert('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const payload = Object.entries(records).map(([studentId, status]) => ({
      studentId: Number(studentId),
      status
    }));
    
    try {
      await api.post('/admin/attendance', { date, subject, records: payload });
      alert('Attendance saved successfully');
    } catch (err) {
      alert('Failed to save attendance');
    }
  };

  const markAll = (status: string) => {
    const newRecords = { ...records };
    students.forEach(s => {
      newRecords[s.id] = status;
    });
    setRecords(newRecords);
  };

  return (
    <Layout role="admin">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-6 lg:p-8 mb-6">
        <h2 className="text-lg font-bold mb-6 text-slate-800">Select Class & Subject</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Semester</label>
            <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none appearance-none bg-white">
              {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Branch</label>
            <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none appearance-none bg-white">
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="EE">EE</option>
              <option value="ME">ME</option>
              <option value="CE">CE</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none appearance-none bg-white">
              <option value="" disabled>Select Subject</option>
              {availableSubjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <button 
              onClick={fetchAttendance}
              disabled={loading || !subject}
              className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Loading...' : 'Fetch Students'}
            </button>
          </div>
        </div>
      </div>

      {students.length > 0 && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4">
            <div className="flex gap-2">
              <button onClick={() => markAll('present')} className="px-4 py-2 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors uppercase tracking-wider">Mark All Present</button>
              <button onClick={() => markAll('absent')} className="px-4 py-2 text-xs font-bold bg-rose-100 text-rose-700 rounded-xl hover:bg-rose-200 transition-colors uppercase tracking-wider">Mark All Absent</button>
            </div>
            <button onClick={handleSave} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
              <Save className="w-4 h-4" />
              Save Attendance
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-white uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-5">PIN No</th>
                  <th className="px-6 py-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const status = records[student.id];
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{student.pin}</td>
                      <td className="px-6 py-4 flex justify-end gap-2">
                        <button
                          onClick={() => setRecords({...records, [student.id]: 'present'})}
                          className={cn("p-2 rounded-xl transition-all border", status === 'present' ? "bg-emerald-500 text-white border-emerald-600 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-100")}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRecords({...records, [student.id]: 'absent'})}
                          className={cn("p-2 rounded-xl transition-all border", status === 'absent' ? "bg-rose-500 text-white border-rose-600 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-100")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRecords({...records, [student.id]: 'leave'})}
                          className={cn("p-2 rounded-xl transition-all border", status === 'leave' ? "bg-amber-500 text-white border-amber-600 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-100")}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
