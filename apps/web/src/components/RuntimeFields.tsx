import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest } from "../lib/api";

export type RuntimeDefinition = {
  _id: string;
  key: string;
  name: string;
  definitionType: "field" | "form" | "workflow" | "formula" | "document";
  configuration: Record<string, unknown>;
};

type RuntimeField = {
  key: string;
  label: string;
  fieldType: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export function extractCustomValues(form: HTMLFormElement) {
  const values: Record<string, string | number | boolean> = {};
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name^='custom__']").forEach((control) => {
    const key = control.name.slice("custom__".length);
    if (control instanceof HTMLInputElement && control.type === "checkbox") values[key] = control.checked;
    else if (control instanceof HTMLInputElement && control.type === "number") values[key] = Number(control.value || 0);
    else values[key] = control.value;
  });
  return values;
}

function FieldControl({ field }: { field: RuntimeField }) {
  const common = { name: `custom__${field.key}`, required: field.required, className: "mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-brand-500", placeholder: field.placeholder };
  if (field.fieldType === "textarea") return <textarea {...common} rows={3} />;
  if (field.fieldType === "select") return <select {...common}><option value="">Select…</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>;
  if (field.fieldType === "checkbox") return <input name={common.name} type="checkbox" className="ml-2 size-4 accent-teal-700" />;
  return <input {...common} type={field.fieldType} />;
}

export function RuntimeFields({ entity }: { entity: "client" | "project" | "measurement" | "quote" | "invoice" }) {
  const [definitions, setDefinitions] = useState<RuntimeDefinition[]>([]);
  useEffect(() => {
    apiRequest<RuntimeDefinition[]>(`/customization/runtime/${entity}`).then(setDefinitions).catch(() => setDefinitions([]));
  }, [entity]);
  const groups = useMemo(() => definitions.flatMap((definition) => {
    if (definition.definitionType === "field") return [{ name: "Additional details", columns: 1, fields: [{ key: definition.key, ...definition.configuration } as unknown as RuntimeField] }];
    if (definition.definitionType === "form") return [{ name: definition.name, columns: Number(definition.configuration.columns ?? 1), fields: (definition.configuration.fields ?? []) as RuntimeField[] }];
    return [];
  }), [definitions]);
  if (!groups.length) return null;
  return <div className="space-y-4 border-t border-slate-200 pt-5">
    <div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Custom business fields</p><p className="mt-1 text-xs text-slate-500">Active fields configured in Custom builders.</p></div>
    {groups.map((group, index) => <fieldset key={`${group.name}-${index}`} className="rounded-2xl bg-slate-50 p-4">
      <legend className="px-1 text-sm font-black text-ink">{group.name}</legend>
      <div className={`mt-2 grid gap-4 ${group.columns === 2 ? "sm:grid-cols-2" : group.columns === 3 ? "sm:grid-cols-3" : "grid-cols-1"}`}>
        {group.fields.map((field) => <label key={field.key} className="text-sm font-bold text-slate-700">{field.label}{field.required && " *"}<FieldControl field={field} /></label>)}
      </div>
    </fieldset>)}
  </div>;
}

export function RuntimeRecordFields({ entity, recordId }: { entity: "quote" | "invoice"; recordId: string }) {
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiRequest(`/customization/values/${entity}/${recordId}`, { method: "PATCH", body: JSON.stringify({ values: extractCustomValues(event.currentTarget) }) });
      setMessage("Custom details saved and formulas recalculated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save custom details");
    }
  }
  return <form onSubmit={save} className="mt-4 rounded-xl border border-slate-200 p-3">
    <RuntimeFields entity={entity} />
    <div className="mt-3 flex items-center gap-3"><button className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">Save custom details</button>{message && <span className="text-xs font-semibold text-slate-500">{message}</span>}</div>
  </form>;
}
