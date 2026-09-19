import { SaveForm } from './SaveForm';
import { useState, useEffect, type FormEvent } from 'react';
import { ShieldAlert, Wrench, Clock, CheckCircle, Search, Plus, Calendar } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Warranty = {
  _id: string;
  warrantyNumber: string;
  projectId?: { _id: string; name: string; projectNumber: string };
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'void';
  daysRemaining?: number;
  expiringSoon?: boolean;
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
type Client = { _id: string; name: string; phone: string };
type Project = { _id: string; name: string; projectNumber: string };
type Membership = { _id: string; userId: { _id: string; name: string } };

export function ServiceAndWarranty() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'warranties'>('tickets');
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [ticketsRes, warrantiesRes, nextClients, nextProjects] = await Promise.all([
          apiRequest<ServiceTicket[]>('/service/tickets'),
          apiRequest<Warranty[]>('/service/warranties'),
          apiRequest<Client[]>('/clients'),
          apiRequest<Project[]>('/projects'),
        ]);
        setTickets(ticketsRes);
        setWarranties(warrantiesRes);
        setClients(nextClients);
        setProjects(nextProjects);
        apiRequest<Membership[]>('/organization/users').then(setMembers).catch(() => setMembers([]));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function reload() {
    const [nextTickets, nextWarranties] = await Promise.all([apiRequest<ServiceTicket[]>('/service/tickets'), apiRequest<Warranty[]>('/service/warranties')]);
    setTickets(nextTickets); setWarranties(nextWarranties);
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    try {
      if (activeTab === 'tickets') await apiRequest('/service/tickets', { method: 'POST', body: JSON.stringify({ clientId: values.get('clientId'), projectId: values.get('projectId') || undefined, warrantyId: values.get('warrantyId') || undefined, description: values.get('description') }) });
      else await apiRequest('/service/warranties', { method: 'POST', body: JSON.stringify({ projectId: values.get('projectId'), startDate: values.get('startDate'), expiryDate: values.get('expiryDate'), terms: values.get('terms') || undefined }) });
      form.reset(); setCreating(false); setMessage(activeTab === 'tickets' ? 'Service ticket created.' : 'Warranty registered.'); await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save record'); }
  }

  async function schedule(ticket: ServiceTicket) {
    const assignedTo = members[0]?.userId._id; if (!assignedTo) { setMessage('Add a staff member before assigning a technician.'); return; }
    const scheduledAt = window.prompt('Visit date and time (YYYY-MM-DD HH:mm)'); if (!scheduledAt) return;
    try { await apiRequest(`/service/tickets/${ticket._id}/schedule`, { method: 'PATCH', body: JSON.stringify({ assignedTo, scheduledAt: new Date(scheduledAt).toISOString() }) }); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to schedule visit'); }
  }

  async function resolve(ticket: ServiceTicket) {
    const signatory = window.prompt('Customer signatory name'); if (!signatory) return;
    const charge = Number(window.prompt('Service charge in rupees', '0') ?? 0);
    try { await apiRequest(`/service/tickets/${ticket._id}/resolve`, { method: 'POST', body: JSON.stringify({ serviceChargePaise: Math.round(charge * 100), customerSignatory: signatory, customerSignature: `Accepted by ${signatory}`, partsUsed: [] }) }); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to resolve ticket'); }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 p-6">
        <h1 className="text-3xl font-black text-slate-800">Service & Warranty</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCreating((value) => !value)} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white"><Plus size={16} /> New {activeTab === 'tickets' ? 'ticket' : 'warranty'}</button>
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
        {message && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{message}</div>}
        {creating && <SaveForm onSubmit={createRecord} className="mb-5 rounded-2xl border border-brand-200 bg-white p-5"><div className="grid gap-3 md:grid-cols-2">{activeTab === 'tickets' ? <><select name="clientId" required className="rounded-xl border border-slate-300 px-3 py-2"><option value="">Select customer</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name} — {client.phone}</option>)}</select><select name="projectId" className="rounded-xl border border-slate-300 px-3 py-2"><option value="">No project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.projectNumber} — {project.name}</option>)}</select><textarea name="description" required minLength={5} placeholder="Complaint or service requirement" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" /></> : <><select name="projectId" required className="rounded-xl border border-slate-300 px-3 py-2"><option value="">Select project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.projectNumber} — {project.name}</option>)}</select><input name="startDate" type="date" required className="rounded-xl border border-slate-300 px-3 py-2" /><input name="expiryDate" type="date" required className="rounded-xl border border-slate-300 px-3 py-2" /><input name="terms" placeholder="Warranty terms" className="rounded-xl border border-slate-300 px-3 py-2" /></>}</div><button className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Save</button></SaveForm>}
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
                <div className="mt-3 flex gap-2">{t.status === 'open' && <button onClick={() => void schedule(t)} className="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-bold text-brand-700">Schedule</button>}{t.status !== 'resolved' && t.status !== 'closed' && <button onClick={() => void resolve(t)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Resolve & sign</button>}</div>
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
                {w.expiringSoon && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Expires in {w.daysRemaining} day(s) — contact the customer</div>}
              </div>
            ))}
            {warranties.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-medium">No warranties found</div>}
          </div>
        )}
      </div>
    </div>
  );
}
