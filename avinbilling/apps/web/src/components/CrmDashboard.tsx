import React, { useState, useEffect } from 'react';
import { Target, Phone, Mail, Clock, CheckCircle, ChevronRight, User, ArchiveX, Plus } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Lead = {
  _id: string;
  leadNumber: string;
  name: string;
  phone: string;
  email?: string;
  source?: string;
  budget?: number;
  stage: 'new' | 'contacted' | 'quoted' | 'won' | 'lost';
  assignedTo?: { _id: string; name: string };
  createdAt: string;
};

const STAGES = [
  { id: 'new', label: 'New Leads', color: 'bg-slate-100 border-slate-300' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-50 border-blue-200' },
  { id: 'quoted', label: 'Quoted', color: 'bg-purple-50 border-purple-200' },
  { id: 'won', label: 'Won', color: 'bg-green-50 border-green-200' },
  { id: 'lost', label: 'Lost', color: 'bg-red-50 border-red-200' },
] as const;

export function CrmDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeads = async () => {
    try {
      const res = await apiRequest<{ data: Lead[] }>('/crm/leads');
      setLeads(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, []);

  const moveLead = async (leadId: string, newStage: string) => {
    try {
      if (newStage === 'won') {
        await apiRequest(`/crm/leads/${leadId}/convert`, { method: 'POST' });
      } else {
        await apiRequest(`/crm/leads/${leadId}/stage`, { 
          method: 'PATCH',
          body: JSON.stringify({ stage: newStage })
        });
      }
      await loadLeads();
    } catch (e) {
      console.error(e);
      alert('Failed to update lead');
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-black text-slate-800">CRM & Leads</h1>
        <button className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-brand-500">
          <Plus size={18} /> New Lead
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-auto p-6">
        {STAGES.map(stage => (
          <div key={stage.id} className={`flex min-w-[320px] flex-col rounded-2xl border ${stage.color} p-4 shadow-sm`}>
            <div className="mb-4 flex items-center justify-between px-2">
              <h3 className="font-bold text-slate-700">{stage.label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-500 shadow-sm">
                {leads.filter(l => l.stage === stage.id).length}
              </span>
            </div>
            
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {leads.filter(l => l.stage === stage.id).map(lead => (
                <div key={lead._id} className="group relative flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800">{lead.name}</h4>
                      <p className="text-xs font-semibold uppercase text-slate-400">{lead.leadNumber}</p>
                    </div>
                    {lead.budget ? (
                      <span className="text-xs font-bold text-green-600">₹{(lead.budget / 100).toLocaleString()}</span>
                    ) : null}
                  </div>
                  
                  <div className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {lead.phone}</div>
                    {lead.email && <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> {lead.email}</div>}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <User size={14} /> {lead.assignedTo?.name || 'Unassigned'}
                    </div>
                    
                    <div className="hidden items-center gap-1 group-hover:flex">
                      {stage.id !== 'new' && (
                        <button onClick={() => moveLead(lead._id, STAGES[STAGES.findIndex(s => s.id === stage.id) - 1]?.id || "")} className="rounded p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="Move Back">
                          <ChevronRight size={16} className="rotate-180" />
                        </button>
                      )}
                      {stage.id !== 'lost' && stage.id !== 'won' && (
                        <>
                          <button onClick={() => moveLead(lead._id, 'lost')} className="rounded p-1 hover:bg-red-50 text-red-400 hover:text-red-600" title="Mark Lost">
                            <ArchiveX size={16} />
                          </button>
                          <button onClick={() => moveLead(lead._id, STAGES[STAGES.findIndex(s => s.id === stage.id) + 1]?.id || "")} className="rounded p-1 hover:bg-brand-50 text-brand-500 hover:text-brand-600" title="Move Forward">
                            <ChevronRight size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {leads.filter(l => l.stage === stage.id).length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white/50 py-8 text-sm font-medium text-slate-400">
                  Drop leads here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
