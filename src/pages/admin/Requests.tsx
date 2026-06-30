import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Requests() {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data } = await api.get('/admin/requests');
    setRequests(data);
  };

  const handleReply = async (id: number, status: 'approved' | 'rejected') => {
    const reply = prompt(`Enter reply message for ${status} status:`, status === 'approved' ? 'Your attendance correction has been approved.' : 'Your request was reviewed and rejected.');
    if (reply === null) return;

    try {
      await api.post(`/admin/requests/${id}/reply`, { status, adminReply: reply });
      fetchRequests();
    } catch (err) {
      alert('Failed to send reply');
    }
  };

  return (
    <Layout role="admin">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Attendance Correction Requests</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Review and resolve student issues.</p>
        </div>

        <div className="divide-y divide-slate-100">
          {requests.map((req) => (
            <div key={req.id} className="p-6 lg:p-8 flex flex-col md:flex-row gap-6 hover:bg-slate-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold border tracking-wider",
                    req.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-200" :
                    req.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    "bg-rose-50 text-rose-700 border-rose-200"
                  )}>
                    {req.status.toUpperCase()}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{req.studentName} <span className="text-slate-400 font-medium">({req.studentPin})</span></span>
                  <span className="text-xs font-semibold text-slate-400">&bull; {req.date}</span>
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{req.subject}</h3>
                <p className="text-slate-600 text-sm">{req.message}</p>
                
                {req.adminReply && (
                  <div className="mt-4 p-4 bg-slate-100 rounded-2xl text-sm border border-slate-200 flex gap-2">
                    <span className="font-bold text-slate-800">Admin:</span>
                    <span className="text-slate-600">{req.adminReply}</span>
                  </div>
                )}
              </div>
              
              {req.status === 'pending' && (
                <div className="flex items-start gap-2 shrink-0">
                  <button 
                    onClick={() => handleReply(req.id, 'approved')}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-sm font-bold border border-emerald-200 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button 
                    onClick={() => handleReply(req.id, 'rejected')}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-sm font-bold border border-rose-200 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          
          {requests.length === 0 && (
            <div className="p-12 text-center text-slate-500 font-medium">
              No correction requests pending.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
