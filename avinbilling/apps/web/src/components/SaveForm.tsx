import { useRef, useState, type FormEvent, type ReactNode } from 'react';

// Captures errors at the form boundary so a failed save never silently disappears.
export function SaveForm({ onSubmit, children, className }: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try { await onSubmit(event); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to save. Please try again.'); }
    finally { busy.current = false; setSaving(false); }
  }
  return <form onSubmit={submit} className={className} aria-busy={saving}>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <fieldset disabled={saving} className="min-w-0 space-y-4 disabled:opacity-70">{children}</fieldset>
    {saving && <p role="status" className="text-sm text-slate-600">Saving… Please wait.</p>}
  </form>;
}
