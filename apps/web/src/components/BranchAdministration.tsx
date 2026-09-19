import { SaveForm } from './SaveForm';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowRightLeft, Building2, Warehouse as WarehouseIcon } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Branch = { _id: string; code: string; name: string; isActive: boolean };
type Warehouse = { _id: string; code: string; name: string; isDefault: boolean; branchId: Branch };
type Project = { _id: string; projectNumber: string; name: string };
type Transfer = { _id: string; entityType: string; reason: string; movedRecords: number; fromBranchId?: Branch; toBranchId: Branch; createdAt: string };

export function BranchAdministration() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const [branchRows, warehouseRows, projectRows, transferRows] = await Promise.all([
      apiRequest<Branch[]>('/organization/branches'), apiRequest<Warehouse[]>('/branches/warehouses'), apiRequest<Project[]>('/projects'), apiRequest<Transfer[]>('/branches/transfers'),
    ]);
    setBranches(branchRows); setWarehouses(warehouseRows); setProjects(projectRows); setTransfers(transferRows);
  }, []);
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load branch controls')); }, [load]);

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    await apiRequest('/branches/warehouses', { method: 'POST', body: JSON.stringify({ branchId: data.get('branchId'), code: data.get('code'), name: data.get('name'), isDefault: data.get('isDefault') === 'on' }) });
    form.reset(); setMessage('Warehouse created.'); await load();
  }
  async function transferProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const result = await apiRequest<{ movedRecords: number }>('/branches/transfers', { method: 'POST', body: JSON.stringify({ entityType: 'project', entityId: data.get('entityId'), toBranchId: data.get('toBranchId'), reason: data.get('reason') }) });
    setMessage(`Project transferred with ${result.movedRecords} linked records.`); await load();
  }

  return <div className="space-y-6">
    {message && <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800">{message}</div>}
    <div className="grid gap-5 xl:grid-cols-2">
      <SaveForm onSubmit={createWarehouse} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-black"><WarehouseIcon size={20}/> Create branch warehouse</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><select name="branchId" required className="rounded-xl border p-3"><option value="">Select branch</option>{branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.code} — {branch.name}</option>)}</select><input name="code" required placeholder="Code, e.g. SOUTH" className="rounded-xl border p-3"/><input name="name" required placeholder="Warehouse name" className="rounded-xl border p-3"/><label className="flex items-center gap-2 rounded-xl border p-3 text-sm font-bold"><input name="isDefault" type="checkbox"/> Default warehouse</label></div>
        <button className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Create warehouse</button>
      </SaveForm>
      <SaveForm onSubmit={transferProject} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-black"><ArrowRightLeft size={20}/> Transfer project and linked records</h2>
        <div className="mt-4 grid gap-3"><select name="entityId" required className="rounded-xl border p-3"><option value="">Select project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.projectNumber} — {project.name}</option>)}</select><select name="toBranchId" required className="rounded-xl border p-3"><option value="">Destination branch</option>{branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.code} — {branch.name}</option>)}</select><input name="reason" required minLength={3} placeholder="Reason for transfer" className="rounded-xl border p-3"/></div>
        <button className="mt-4 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white">Transfer project</button>
      </SaveForm>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="flex items-center gap-2 text-lg font-black"><Building2 size={20}/> Warehouses</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{warehouses.map((warehouse) => <article key={warehouse._id} className="rounded-xl border p-4"><div className="font-black">{warehouse.code} — {warehouse.name}</div><div className="mt-1 text-sm text-slate-500">{warehouse.branchId?.name}{warehouse.isDefault ? ' · Default' : ''}</div></article>)}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="text-lg font-black">Transfer history</h2><div className="mt-4 space-y-2">{transfers.length ? transfers.map((item) => <div key={item._id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>{item.entityType}</b> · {item.fromBranchId?.code ?? 'Unassigned'} → {item.toBranchId?.code} · {item.movedRecords} records · {item.reason}</div>) : <p className="text-sm text-slate-500">No transfers recorded.</p>}</div></section>
  </div>;
}
