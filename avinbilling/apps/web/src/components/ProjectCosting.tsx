import { SaveForm } from './SaveForm';
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, CircleDollarSign, ClipboardCheck, Plus, RotateCcw, TrendingUp } from "lucide-react";
import { apiRequest } from "../lib/api";

type Project = { _id: string; projectNumber: string; name: string };
type Budget = { _id: string; status: "draft" | "submitted" | "approved"; approvalThresholdPaise: number; [key: string]: unknown };
type Cost = { _id: string; category: string; description: string; vendor?: string; amountPaise: number; status: "pending" | "approved" | "rejected"; incurredAt: string };
type Change = { _id: string; changeNumber: string; title: string; revenueImpactPaise: number; costImpactPaise: number; status: "draft" | "submitted" | "approved" | "rejected" };
type CostingData = {
  project: Project;
  budget: Budget | null;
  costs: Cost[];
  changes: Change[];
  summary: Record<string, number>;
};

const money = (paise = 0) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rupees = (paise: unknown) => Number(paise ?? 0) / 100;
const toPaise = (value: FormDataEntryValue | null) => Math.round(Number(value ?? 0) * 100);
const budgetFields = [
  ["materialsPaise", "Materials"], ["labourPaise", "Labour"], ["subcontractorPaise", "Subcontractors"],
  ["transportPaise", "Transport"], ["installationPaise", "Installation"], ["sitePaise", "Site expenses"],
  ["overheadPaise", "General overhead"], ["contingencyPaise", "Contingency"],
] as const;
const categories = [
  ["labour", "Labour"], ["subcontractor", "Subcontractor"], ["transport", "Transport"],
  ["installation", "Installation"], ["site", "Site expense"], ["general", "General expense"],
  ["miscellaneous", "Miscellaneous"], ["material_issue", "Material issued"], ["material_return", "Material returned"],
] as const;

export function ProjectCosting({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState(projects[0]?._id ?? "");
  const [data, setData] = useState<CostingData | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (!projectId) { setData(null); return; }
    try { setData(await apiRequest<CostingData>(`/costing/projects/${projectId}`)); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load project costing"); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0]._id); }, [projectId, projects]);

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest(`/costing/projects/${projectId}/budget`, { method: "PUT", body: JSON.stringify(Object.fromEntries([...budgetFields.map(([key]) => [key, toPaise(form.get(key))]), ["approvalThresholdPaise", toPaise(form.get("approvalThresholdPaise"))]])) });
      setMessage("Draft project budget saved."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save budget"); }
  }
  async function budgetAction(action: "submit" | "approve") {
    try { await apiRequest(`/costing/projects/${projectId}/budget/${action}`, { method: "POST" }); setMessage(action === "submit" ? "Budget submitted for approval." : "Budget approved and locked."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Budget action failed"); }
  }
  async function addCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const quantity = Number(form.get("quantity") ?? 1); const unitRatePaise = toPaise(form.get("unitRate"));
    try { await apiRequest(`/costing/projects/${projectId}/costs`, { method: "POST", body: JSON.stringify({ category: form.get("category"), description: form.get("description"), vendor: form.get("vendor") || undefined, quantity, unit: form.get("unit") || "fixed", unitRatePaise, amountPaise: Math.max(1, Math.round(quantity * unitRatePaise)), incurredAt: form.get("incurredAt") }) }); formElement.reset(); setMessage("Project cost recorded with the configured approval control."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add cost"); }
  }
  async function addChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    try { await apiRequest(`/costing/projects/${projectId}/changes`, { method: "POST", body: JSON.stringify({ title: form.get("title"), description: form.get("description") || undefined, reason: form.get("reason") || undefined, revenueImpactPaise: toPaise(form.get("revenueImpact")), costImpactPaise: toPaise(form.get("costImpact")) }) }); formElement.reset(); setMessage("Variation submitted for approval."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add variation"); }
  }
  async function setStatus(kind: "costs" | "changes", id: string, status: "approved" | "rejected") {
    try { await apiRequest(`/costing/${kind}/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Approval action failed"); }
  }

  if (!projects.length) return <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Create a project before preparing its budget and recording costs.</div>;
  const summary = data?.summary ?? {};
  return <div className="mt-7 space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <label className="text-sm font-black text-slate-700">Costing project<select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-normal">{projects.map((project) => <option key={project._id} value={project._id}>{project.projectNumber} — {project.name}</option>)}</select></label>
      {message && <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{message}</div>}
    </section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[["Contract revenue", summary.revenuePaise, CircleDollarSign], ["Approved budget", summary.estimatedCostPaise, ClipboardCheck], ["Actual project cost", summary.actualCostPaise, CheckCircle2], ["Net project profit", summary.netProfitPaise, TrendingUp], ["Budget variance", summary.budgetVariancePaise, TrendingUp], ["Gross profit", summary.grossProfitPaise, TrendingUp], ["Purchase commitments", summary.committedPurchasePaise, ClipboardCheck], ["Costs awaiting approval", summary.pendingCostPaise, ClipboardCheck]].map(([label, value, Icon]) => { const DisplayIcon = Icon as typeof CircleDollarSign; return <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><DisplayIcon size={19} className="text-brand-600" /><div className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">{String(label)}</div><div className="mt-1 text-xl font-black text-ink">{money(Number(value ?? 0))}</div></article>; })}
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <SaveForm key={data?.budget?._id ?? "new"} onSubmit={saveBudget} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-ink">Project budget</h2><p className="text-sm text-slate-500">Estimated cost baseline</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{data?.budget?.status ?? "not created"}</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{budgetFields.map(([key, label]) => <label key={key} className="text-xs font-bold text-slate-600">{label}<input name={key} type="number" min="0" step="0.01" defaultValue={rupees(data?.budget?.[key])} disabled={data?.budget?.status === "approved"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-100" /></label>)}</div>
        <label className="mt-3 block text-xs font-bold text-slate-600">Cost approval threshold<input name="approvalThresholdPaise" type="number" min="0" step="0.01" defaultValue={rupees(data?.budget?.approvalThresholdPaise ?? 1_000_000)} disabled={data?.budget?.status === "approved"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-100" /></label>
        <div className="mt-4 flex flex-wrap gap-2">{data?.budget?.status !== "approved" && <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">Save draft</button>}{data?.budget?.status === "draft" && <button type="button" onClick={() => void budgetAction("submit")} className="rounded-xl border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700">Submit</button>}{data?.budget?.status === "submitted" && <button type="button" onClick={() => void budgetAction("approve")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Approve & lock</button>}</div>
      </SaveForm>
      <SaveForm onSubmit={addCost} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="text-lg font-black text-ink">Record actual cost</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Category<select name="category" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Date<input name="incurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Description<input name="description" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600">Vendor / worker<input name="vendor" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600">Unit<input name="unit" defaultValue="fixed" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600">Quantity<input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600">Rate (₹)<input name="unitRate" type="number" min="0.01" step="0.01" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label></div><button className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"><Plus size={15} /> Add cost</button></SaveForm>
    </div>
    <SaveForm onSubmit={addChange} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="text-lg font-black text-ink">Change order / variation</h2><div className="mt-4 grid gap-3 md:grid-cols-4"><label className="text-xs font-bold text-slate-600 md:col-span-2">Title<input name="title" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600">Customer value (₹)<input name="revenueImpact" type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600">Expected cost (₹)<input name="costImpact" type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600 md:col-span-2">Description<input name="description" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-xs font-bold text-slate-600 md:col-span-2">Reason<input name="reason" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label></div><button className="mt-4 flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white"><Plus size={15} /> Submit variation</button></SaveForm>
    <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="font-black text-ink">Cost ledger</h2><div className="mt-3 space-y-3">{data?.costs.map((cost) => <article key={cost._id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><div><b className="text-sm text-ink">{cost.description}</b><div className="text-xs capitalize text-slate-500">{cost.category.replaceAll("_", " ")} · {cost.vendor || "Internal"}</div></div><div className="text-right"><b>{cost.category === "material_return" ? "−" : ""}{money(cost.amountPaise)}</b><div className="text-xs capitalize text-slate-500">{cost.status}</div></div></div>{cost.status === "pending" && <div className="mt-2 flex gap-2"><button onClick={() => void setStatus("costs", cost._id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Approve</button><button onClick={() => void setStatus("costs", cost._id, "rejected")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600">Reject</button></div>}</article>)}{!data?.costs.length && <p className="text-sm text-slate-500">No actual costs recorded.</p>}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="font-black text-ink">Variations</h2><div className="mt-3 space-y-3">{data?.changes.map((change) => <article key={change._id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><div><b className="text-sm text-ink">{change.changeNumber} · {change.title}</b><div className="text-xs capitalize text-slate-500">{change.status}</div></div><div className="text-right text-xs"><b className="block text-emerald-700">+{money(change.revenueImpactPaise)}</b><span className="text-slate-500">Cost {money(change.costImpactPaise)}</span></div></div>{change.status === "submitted" && <div className="mt-2 flex gap-2"><button onClick={() => void setStatus("changes", change._id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Approve</button><button onClick={() => void setStatus("changes", change._id, "rejected")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600">Reject</button></div>}</article>)}{!data?.changes.length && <p className="text-sm text-slate-500">No change orders recorded.</p>}</div></section></div>
    <section className="rounded-2xl bg-slate-950 p-6 text-white"><div className="flex items-center gap-2 text-emerald-300"><RotateCcw size={17} /><b className="text-xs uppercase tracking-wider">Estimated versus actual</b></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><span className="text-sm text-slate-400">Budget used</span><b className="mt-1 block text-2xl">{summary.estimatedCostPaise ? `${Math.round(Number(summary.actualCostPaise ?? 0) / Number(summary.estimatedCostPaise) * 1000) / 10}%` : "0%"}</b></div><div><span className="text-sm text-slate-400">Gross margin</span><b className="mt-1 block text-2xl">{summary.grossMarginPercent ?? 0}%</b></div><div><span className="text-sm text-slate-400">Net margin</span><b className="mt-1 block text-2xl">{summary.netMarginPercent ?? 0}%</b></div></div></section>
  </div>;
}
