import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { Plus, Bell } from 'lucide-react';

export default function Notices() {
  const [notices, setNotices] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '' });

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    const { data } = await api.get('/notices');
    // Sort descending by ID or Date
    setNotices(data.sort((a: any, b: any) => b.id - a.id));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/notices', formData);
      setShowAdd(false);
      setFormData({ title: '', content: '' });
      fetchNotices();
    } catch (err) {
      alert('Error creating notice');
    }
  };

  return (
    <Layout role="admin">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 lg:p-8 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Campus Notices</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Broadcast announcements to all students.</p>
          </div>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 shrink-0"
          >
            <Plus className="w-4 h-4" /> Post Notice
          </button>
        </div>

        {showAdd && (
          <div className="p-6 lg:p-8 border-b border-slate-200 bg-slate-50">
            <form onSubmit={handleAdd} className="space-y-4 max-w-2xl bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl font-medium outline-none focus:border-indigo-500 text-sm" placeholder="e.g. Internal Test Schedule" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Content</label>
                <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl h-32 outline-none focus:border-indigo-500 text-sm" placeholder="Write notice details here..."></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Publish Notice</button>
              </div>
            </form>
          </div>
        )}

        <div className="divide-y divide-slate-100 p-2 lg:p-4">
          {notices.map((notice) => (
            <div key={notice.id} className="p-4 lg:p-6 hover:bg-slate-50 transition-colors rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl mt-1 shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{notice.title}</h3>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3 mt-1">Posted on {notice.date}</p>
                  <p className="text-slate-600 whitespace-pre-wrap text-sm">{notice.content}</p>
                </div>
              </div>
            </div>
          ))}
          {notices.length === 0 && (
            <div className="p-12 text-center text-slate-500 font-medium">
              No notices published yet.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
