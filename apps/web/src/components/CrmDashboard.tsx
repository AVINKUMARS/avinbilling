import { SaveForm } from './SaveForm';
import { ConfirmModal } from './ConfirmModal';
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArchiveX, Bell, CheckCircle2, ChevronRight, Phone, Plus, Target, UserRound, Edit, Trash2, X } from "lucide-react";
import { apiRequest } from "../lib/api";

type Lead = { _id: string; leadNumber: string; name: string; phone: string; email?: string; source?: string; budget?: number; stage: "new" | "contacted" | "quoted" | "won" | "lost"; lostReason?: string; assignedTo?: { name: string } };
type Reminder = { _id: string; description: string; nextReminderAt: string; leadId?: { leadNumber: string; name: string; phone: string } };
type Performance = { _id?: string; salesperson: string; leads: number; won: number; lost: number; pipelinePaise: number; conversionPercent: number };
const stages = ["new", "contacted", "quoted", "won", "lost"] as const;

export function CrmDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [performance, setPerformance] = useState<Performance[]>([]);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextLeads, nextReminders] = await Promise.all([apiRequest<Lead[]>("/crm/leads"), apiRequest<Reminder[]>("/crm/reminders")]);
      setLeads(nextLeads); setReminders(nextReminders);
      apiRequest<Performance[]>("/crm/performance").then(setPerformance).catch(() => setPerformance([]));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load CRM"); }
  }, []);
  
  useEffect(() => { void load(); }, [load]);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    try { await apiRequest("/crm/leads", { method: "POST", body: JSON.stringify({ name: values.get("name"), phone: values.get("phone"), email: values.get("email") || undefined, source: values.get("source") || "Direct", budget: Math.round(Number(values.get("budget") || 0) * 100), notes: values.get("notes") || undefined }) }); form.reset(); setCreating(false); setMessage("Lead captured successfully."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create lead"); }
  }

  async function move(lead: Lead, stage: typeof stages[number]) {
    try {
      if (stage === "won") await apiRequest(`/crm/leads/${lead._id}/convert`, { method: "POST" });
      else { const lostReason = stage === "lost" ? window.prompt("Why was this lead lost?") || "Not specified" : undefined; await apiRequest(`/crm/leads/${lead._id}/stage`, { method: "PATCH", body: JSON.stringify({ stage, lostReason }) }); }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update lead"); }
  }

  async function addFollowUp(lead: Lead) {
    const description = window.prompt(`Follow-up note for ${lead.name}`); if (!description) return;
    const nextReminderAt = window.prompt("Next reminder date and time (YYYY-MM-DD HH:mm), optional");
    try { await apiRequest(`/crm/leads/${lead._id}/follow-ups`, { method: "POST", body: JSON.stringify({ type: "call", description, nextReminderAt: nextReminderAt ? new Date(nextReminderAt).toISOString() : undefined }) }); setMessage("Follow-up recorded."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add follow-up"); }
  }

  async function completeReminder(id: string) { try { await apiRequest(`/crm/follow-ups/${id}/complete`, { method: "PATCH" }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to complete reminder"); } }

  function confirmDelete(lead: Lead) {
    setConfirmAction({
      message: `Are you sure you want to delete the lead ${lead.name}?`,
      onConfirm: async () => {
        try {
          await apiRequest(`/crm/leads/${lead._id}`, { method: "DELETE" });
          setMessage("Lead deleted successfully.");
          await load();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Unable to delete lead");
        }
      }
    });
  }

  async function handleEditLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLead) return;
    const values = new FormData(event.currentTarget);
    try {
      await apiRequest(`/crm/leads/${editingLead._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.get("name"),
          phone: values.get("phone"),
          email: values.get("email") || undefined,
          source: values.get("source") || "Direct",
          budget: Math.round(Number(values.get("budget") || 0) * 100),
          notes: values.get("notes") || undefined
        })
      });
      setEditingLead(null);
      setMessage("Lead updated successfully.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update lead");
    }
  }

  return (
    <div className="mt-7 space-y-6 pb-12">
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 p-6 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
            <Target size={19} />
            <b className="text-xs uppercase tracking-wider">Sales pipeline</b>
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Leads and follow-ups</h2>
        </div>
        <button onClick={() => setCreating((value) => !value)} className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 transition-colors">
          <Plus size={16} /> New lead
        </button>
      </section>

      {message && <div className="rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 px-4 py-3 text-sm font-semibold text-brand-700 dark:text-brand-400">{message}</div>}

      {creating && (
        <SaveForm onSubmit={createLead} className="rounded-3xl border border-brand-200 dark:border-brand-500/30 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input name="name" required placeholder="Customer name" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
            <input name="phone" required placeholder="Phone" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
            <input name="email" type="email" placeholder="Email" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
            <input name="source" placeholder="Source: referral, website…" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
            <input name="budget" type="number" min="0" step="0.01" placeholder="Expected budget ₹" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
            <input name="notes" placeholder="Requirement notes" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white sm:col-span-2" />
          </div>
          <button className="mt-5 rounded-xl bg-slate-900 dark:bg-white px-6 py-2.5 text-sm font-bold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">Save lead</button>
        </SaveForm>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
        {stages.map((stage, stageIndex) => (
          <section key={stage} className="min-w-80 w-80 shrink-0 snap-start rounded-3xl border border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/30 p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
              <b className="text-sm font-bold capitalize text-slate-800 dark:text-slate-200">{stage}</b>
              <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                {leads.filter((lead) => lead.stage === stage).length}
              </span>
            </div>
            <div className="flex-1 space-y-3">
              {leads.filter((lead) => lead.stage === stage).map((lead) => (
                <article key={lead._id} className="group rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition-all relative">
                  <div className="flex justify-between gap-3 items-start">
                    <div>
                      <b className="text-slate-900 dark:text-white leading-tight block">{lead.name}</b>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{lead.leadNumber}</div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-100 dark:border-white/5">
                      <button onClick={() => setEditingLead(lead)} className="text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Edit"><Edit size={14} /></button>
                      <button onClick={() => confirmDelete(lead)} className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  
                  {Boolean(lead.budget) && <div className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-md px-2 py-1 w-fit">₹{((lead.budget ?? 0) / 100).toLocaleString("en-IN")}</div>}
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Phone size={14} className="text-slate-400" />{lead.phone}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><UserRound size={14} className="text-slate-400" />{lead.assignedTo?.name ?? "Unassigned"}</div>
                  </div>

                  {lead.lostReason && <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20">{lead.lostReason}</div>}
                  
                  <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 dark:border-white/5 pt-4">
                    <button onClick={() => void addFollowUp(lead)} className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Follow-up</button>
                    <div className="flex-1"></div>
                    {stageIndex > 0 && stage !== "won" && stage !== "lost" && <button onClick={() => void move(lead, stages[stageIndex - 1]!)} className="rounded-lg border border-slate-200 dark:border-white/10 p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" aria-label="Move back"><ChevronRight className="rotate-180" size={15} /></button>}
                    {stage !== "won" && stage !== "lost" && <>
                      <button onClick={() => void move(lead, "lost")} className="rounded-lg border border-red-200 dark:border-red-500/30 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" aria-label="Mark lost"><ArchiveX size={15} /></button>
                      <button onClick={() => void move(lead, stages[stageIndex + 1]!)} className="rounded-lg bg-brand-600 dark:bg-brand-500 p-1.5 text-white hover:bg-brand-700 dark:hover:bg-brand-400 transition-colors" aria-label="Move forward"><ChevronRight size={15} /></button>
                    </>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Bell className="text-amber-500" size={18} />
            <h2 className="font-black text-slate-900 dark:text-white text-lg">Follow-up reminders</h2>
          </div>
          <div className="mt-4 space-y-3">
            {reminders.map((reminder) => (
              <article key={reminder._id} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-white/5 p-4 transition-colors hover:border-slate-200 dark:hover:border-white/10">
                <div>
                  <b className="text-sm text-slate-900 dark:text-white block mb-1">{reminder.leadId?.name ?? "Lead"}</b>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{reminder.description} · {new Date(reminder.nextReminderAt).toLocaleString()}</div>
                </div>
                <button onClick={() => void completeReminder(reminder._id)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors p-2" aria-label="Complete reminder">
                  <CheckCircle2 size={22} />
                </button>
              </article>
            ))}
            {!reminders.length && <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-white/5">No pending reminders.</p>}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-6 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Target className="text-blue-500" size={18} />
            <h2 className="font-black text-slate-900 dark:text-white text-lg">Salesperson performance</h2>
          </div>
          <div className="mt-4 space-y-3">
            {performance.map((row) => (
              <div key={row._id ?? "unassigned"} className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-white/5 p-4 text-sm items-center">
                <b className="text-slate-900 dark:text-white">{row.salesperson}</b>
                <span className="text-slate-600 dark:text-slate-300 text-center">{row.leads} leads</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-center">{row.won} won</span>
                <span className="text-slate-500 dark:text-slate-400 text-right">{row.conversionPercent}%</span>
              </div>
            ))}
            {!performance.length && <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-white/5">No assigned lead performance yet.</p>}
          </div>
        </section>
      </div>

      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />

      {editingLead && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-auto rounded-[2rem] bg-white dark:bg-slate-900 p-6 shadow-2xl md:p-8 border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Edit lead</h2>
              <button onClick={() => setEditingLead(null)} className="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">
                <X size={19} />
              </button>
            </div>
            <SaveForm onSubmit={handleEditLead} className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <input name="name" required defaultValue={editingLead.name} placeholder="Customer name" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
                <input name="phone" required defaultValue={editingLead.phone} placeholder="Phone" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
                <input name="email" type="email" defaultValue={editingLead.email} placeholder="Email" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
                <input name="source" defaultValue={editingLead.source} placeholder="Source: referral, website…" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
                <input name="budget" type="number" min="0" step="0.01" defaultValue={editingLead.budget ? editingLead.budget / 100 : undefined} placeholder="Expected budget ₹" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white" />
                <input name="notes" placeholder="Requirement notes" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent px-4 py-3 text-slate-900 dark:text-white sm:col-span-2" />
              </div>
              <button className="mt-6 w-full rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-brand-700 transition-colors shadow-sm">
                Update lead
              </button>
            </SaveForm>
          </div>
        </div>
      )}
    </div>
  );
}
