import { Check, LockKeyhole } from 'lucide-react';
import type { BusinessModule } from '@avin/module-registry';

type Props = {
  module: BusinessModule;
  enabled: boolean;
  onToggle: () => void;
};

export function ModuleCard({ module, enabled, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex min-h-40 flex-col justify-between rounded-2xl border p-5 text-left transition ${
        enabled
          ? 'border-brand-500 bg-brand-50 shadow-sm'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card'
      }`}
    >
      <div className="flex w-full items-start justify-between gap-4">
        <div className={`grid size-10 place-items-center rounded-xl ${enabled ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {enabled ? <Check size={19} strokeWidth={2.5} /> : <LockKeyhole size={18} />}
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200">
          {module.phase}
        </span>
      </div>
      <div>
        <h3 className="mt-6 text-base font-bold text-ink">{module.name}</h3>
        <p className="mt-1.5 text-sm leading-5 text-slate-600">{module.description}</p>
      </div>
    </button>
  );
}
