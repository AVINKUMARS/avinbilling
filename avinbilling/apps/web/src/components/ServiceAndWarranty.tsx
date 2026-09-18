import React, { useState, useEffect } from 'react';
import { ShieldAlert, Wrench, Clock, CheckCircle, Search, Plus, Calendar } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Warranty = {
  _id: string;
  warrantyNumber: string;
  projectId?: { _id: string; name: string; projectNumber: string };
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'void';
};

type ServiceTicket = {
  _id: string;
  ticketNumber: string;
  clientId?: { _id: string; name: string; phone: string };
  projectId?: { _id: string; name: string; projectNumber: string };
  description: string;
  status: 'open' | 'scheduled' | 'in_progress' | 'resolved' | 'closed';
  scheduledAt?: string;
  serviceChargePaise: number;
  assignedTo?: { _id: string; name: string };
};

export function ServiceAndWarranty() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'warranties'>('tickets');
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [ticketsRes, warrantiesRes] = await Promise.all([
          apiRequest<{ data: ServiceTicket[] }>('/service/tickets'),
          apiRequest<{ data: Warranty[] }>('/service/warranties'),
        ]);
        setTickets(ticketsRes.data);
        setWarranties(warrantiesRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 p-6">
        <h1 className="text-3xl font-black text-slate-800">Service & Warranty</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'tickets' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Service Tickets
          </button>
          <button
            onClick={() => setActiveTab('warranties')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'warranties' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Warranties
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">Loading records...</div>
        ) : activeTab === 'tickets' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tickets.map(t => (
              <div key={t._id} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">{t.ticketNumber}</span>
                  <span className={`px-2 py-1 text-xs font-bold rounded-lg ${t.status === 'open' ? 'bg-red-100 text-red-700' : t.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{t.status}</span>
                </div>
                <h3 className="font-bold text-slate-800">{t.clientId?.name || 'Unknown Client'}</h3>
                {t.projectId && <p className="text-sm text-slate-500 mb-4">{t.projectId.name}</p>}
                <p className="text-sm text-slate-700 line-clamp-2">{t.description}</p>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-4 text-xs text-slate-500 font-medium">
                  {t.assignedTo ? (
                    <div className="flex items-center gap-1.5"><Wrench size={14}/> {t.assignedTo.name}</div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-orange-600"><Wrench size={14}/> Unassigned</div>
                  )}
                  {t.scheduledAt && <div className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(t.scheduledAt).toLocaleDateString()}</div>}
                </div>
              </div>
            ))}
            {tickets.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-medium">No service tickets found</div>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {warranties.map(w => (
              <div key={w._id} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">{w.warrantyNumber}</span>
                  <span className={`px-2 py-1 text-xs font-bold rounded-lg ${w.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{w.status}</span>
                </div>
                <h3 className="font-bold text-slate-800">{w.projectId?.name || 'Unknown Project'}</h3>
                <div className="mt-4 flex gap-4 text-sm font-medium">
                  <div>
                    <div className="text-slate-400 text-xs uppercase mb-1">Start Date</div>
                    <div className="text-slate-700">{new Date(w.startDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs uppercase mb-1">Expiry Date</div>
                    <div className="text-slate-700">{new Date(w.expiryDate).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            ))}
            {warranties.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-medium">No warranties found</div>}
          </div>
        )}
      </div>
    </div>
  );
}
