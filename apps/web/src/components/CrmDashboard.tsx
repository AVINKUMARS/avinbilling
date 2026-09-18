import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArchiveX, Bell, CheckCircle2, ChevronRight, Phone, Plus, Target, UserRound } from "lucide-react";
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

  return <div className="mt-7 space-y-6">
    <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-brand-600"><Target size={19} /><b className="text-xs uppercase tracking-wider">Sales pipeline</b></div><h2 className="mt-2 text-xl font-black text-ink">Leads and follow-ups</h2></div><button onClick={() => setCreating((value) => !value)} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"><Plus size={16} /> New lead</button></section>
    {message && <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{message}</div>}
    {creating && <form onSubmit={createLead} className="rounded-2xl border border-brand-200 bg-white p-5 shadow-card"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input name="name" required placeholder="Customer name" className="rounded-xl border border-slate-300 px-4 py-3" /><input name="phone" required placeholder="Phone" className="rounded-xl border border-slate-300 px-4 py-3" /><input name="email" type="email" placeholder="Email" className="rounded-xl border border-slate-300 px-4 py-3" /><input name="source" placeholder="Source: referral, website…" className="rounded-xl border border-slate-300 px-4 py-3" /><input name="budget" type="number" min="0" step="0.01" placeholder="Expected budget ₹" className="rounded-xl border border-slate-300 px-4 py-3" /><input name="notes" placeholder="Requirement notes" className="rounded-xl border border-slate-300 px-4 py-3 sm:col-span-2" /></div><button className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Save lead</button></form>}
    <div className="grid gap-4 overflow-x-auto xl:grid-cols-5">{stages.map((stage, stageIndex) => <section key={stage} className="min-w-64 rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex justify-between px-1"><b className="text-sm capitalize text-ink">{stage}</b><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">{leads.filter((lead) => lead.stage === stage).length}</span></div><div className="mt-3 space-y-3">{leads.filter((lead) => lead.stage === stage).map((lead) => <article key={lead._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between gap-2"><div><b className="text-ink">{lead.name}</b><div className="text-xs text-slate-400">{lead.leadNumber}</div></div>{Boolean(lead.budget) && <span className="text-xs font-bold text-emerald-700">₹{((lead.budget ?? 0) / 100).toLocaleString("en-IN")}</span>}</div><div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Phone size={13} />{lead.phone}</div><div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><UserRound size={13} />{lead.assignedTo?.name ?? "Unassigned"}</div>{lead.lostReason && <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{lead.lostReason}</div>}<div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3"><button onClick={() => void addFollowUp(lead)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold">Follow-up</button>{stageIndex > 0 && stage !== "won" && stage !== "lost" && <button onClick={() => void move(lead, stages[stageIndex - 1]!)} className="rounded-lg border border-slate-200 p-1" aria-label="Move back"><ChevronRight className="rotate-180" size={15} /></button>}{stage !== "won" && stage !== "lost" && <><button onClick={() => void move(lead, "lost")} className="rounded-lg border border-red-100 p-1 text-red-500" aria-label="Mark lost"><ArchiveX size={15} /></button><button onClick={() => void move(lead, stages[stageIndex + 1]!)} className="rounded-lg bg-brand-600 p-1 text-white" aria-label="Move forward"><ChevronRight size={15} /></button></>}</div></article>)}</div></section>)}</div>
    <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center gap-2"><Bell className="text-amber-500" size={18} /><h2 className="font-black text-ink">Follow-up reminders</h2></div><div className="mt-3 space-y-2">{reminders.map((reminder) => <article key={reminder._id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><b className="text-sm">{reminder.leadId?.name ?? "Lead"}</b><div className="text-xs text-slate-500">{reminder.description} · {new Date(reminder.nextReminderAt).toLocaleString()}</div></div><button onClick={() => void completeReminder(reminder._id)} className="text-emerald-600" aria-label="Complete reminder"><CheckCircle2 size={19} /></button></article>)}{!reminders.length && <p className="text-sm text-slate-500">No pending reminders.</p>}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="font-black text-ink">Salesperson performance</h2><div className="mt-3 space-y-2">{performance.map((row) => <div key={row._id ?? "unassigned"} className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-3 text-sm"><b>{row.salesperson}</b><span>{row.leads} leads</span><span>{row.won} won</span><span>{row.conversionPercent}%</span></div>)}{!performance.length && <p className="text-sm text-slate-500">No assigned lead performance yet.</p>}</div></section></div>
  </div>;
}
