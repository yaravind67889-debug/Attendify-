import React, { useState, useEffect } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import api from '../../lib/api';
import Layout from '../../components/Layout';
import { cn } from '../../lib/utils';

interface Subject {
  id: number;
  name: string;
  semester: number;
  department: string;
}

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', semester: 1, department: 'CSE' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const { data } = await api.get('/admin/subjects');
      setSubjects(data);
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/subjects', formData);
      setShowAdd(false);
      setFormData({ name: '', semester: 1, department: 'CSE' });
      fetchSubjects();
    } catch (error) {
      alert('Failed to add subject');
    }
  };

  return (
    <Layout role="admin">
      <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Class Subjects</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Manage subjects for different classes</p>
          </div>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>
        </div>

        {showAdd && (
          <div className="p-6 mb-6 rounded-[1.5rem] border border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              Register New Subject
            </h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subject Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none" placeholder="e.g. Data Structures" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Branch / Department</label>
                <select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none appearance-none bg-white">
                  <option value="CSE">Computer Science (CSE)</option>
                  <option value="ECE">Electronics (ECE)</option>
                  <option value="EE">Electrical (EE)</option>
                  <option value="ME">Mechanical (ME)</option>
                  <option value="CE">Civil (CE)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Semester</label>
                <select value={formData.semester} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none appearance-none bg-white">
                  {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-3 flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Save Subject</button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Subject Name</th>
                <th className="px-6 py-4">Branch / Dept</th>
                <th className="px-6 py-4">Semester</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((subject) => (
                <tr key={subject.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    {subject.name}
                  </td>
                  <td className="px-6 py-4 font-semibold text-indigo-600 uppercase">{subject.department || 'CSE'}</td>
                  <td className="px-6 py-4 font-medium text-slate-700">Semester {subject.semester}</td>
                </tr>
              ))}
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500 font-medium">
                    No subjects defined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
