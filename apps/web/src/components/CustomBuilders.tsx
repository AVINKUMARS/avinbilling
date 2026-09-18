import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Archive,
  Braces,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FormInput,
  GitBranch,
  ListPlus,
  Pencil,
  Play,
  Plus,
  Upload,
  Workflow,
} from "lucide-react";
import { apiRequest } from "../lib/api";

type DefinitionType = "field" | "form" | "workflow" | "formula" | "document";
type DefinitionStatus = "draft" | "active" | "archived";
type CustomDefinition = {
  _id: string;
  definitionType: DefinitionType;
  key: string;
  name: string;
  version: number;
  status: DefinitionStatus;
  configuration: Record<string, unknown>;
  updatedAt: string;
};

const builderTypes: Array<{
  key: DefinitionType;
  label: string;
  description: string;
  icon: typeof FormInput;
}> = [
  { key: "field", label: "Fields", description: "Add business-specific information", icon: FormInput },
  { key: "form", label: "Forms", description: "Arrange reusable data-entry forms", icon: ListPlus },
  { key: "formula", label: "Formulas", description: "Create calculated business values", icon: Braces },
  { key: "workflow", label: "Workflows", description: "Define stages and approvals", icon: Workflow },
  { key: "document", label: "Documents", description: "Configure printable document layouts", icon: FileText },
];

const entities = ["client", "project", "measurement", "quote", "invoice"];
const fieldTypes = ["text", "number", "date", "select", "checkbox", "textarea"];
const documentBlocks = ["company", "customer", "project", "items", "tax", "terms", "signature", "payment", "notes"];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function CustomBuilders() {
  const [definitions, setDefinitions] = useState<CustomDefinition[]>([]);
  const [selectedType, setSelectedType] = useState<DefinitionType>("field");
  const [statusFilter, setStatusFilter] = useState<"all" | DefinitionStatus>("all");
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [entity, setEntity] = useState("project");
  const [fieldType, setFieldType] = useState("text");
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [columns, setColumns] = useState(1);
  const [formFields, setFormFields] = useState("site_name | Site name | text | required");
  const [workflowStages, setWorkflowStages] = useState("New\nSurvey\nApproval *\nCompleted");
  const [expression, setExpression] = useState("widthMm * heightMm / 1000000");
  const [variables, setVariables] = useState("widthMm, heightMm");
  const [resultUnit, setResultUnit] = useState("sqm");
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [documentType, setDocumentType] = useState("quotation");
  const [blocks, setBlocks] = useState<string[]>(["company", "customer", "items", "tax", "terms", "signature"]);
  const [accentColor, setAccentColor] = useState("#0f766e");
  const [footer, setFooter] = useState("Thank you for your business.");
  const [showLogo, setShowLogo] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDefinitions(await apiRequest<CustomDefinition[]>("/operations/custom-definitions"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load custom builders");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleDefinitions = useMemo(
    () => definitions.filter((definition) =>
      definition.definitionType === selectedType &&
      (statusFilter === "all" || definition.status === statusFilter)),
    [definitions, selectedType, statusFilter],
  );

  function configuration(): Record<string, unknown> {
    if (selectedType === "field") {
      return {
        entity,
        label: name,
        fieldType,
        required,
        placeholder: placeholder || undefined,
        options: optionsText.split(",").map((value) => value.trim()).filter(Boolean),
      };
    }
    if (selectedType === "form") {
      return {
        entity,
        description: placeholder || undefined,
        columns,
        fields: parseLines(formFields).map((line) => {
          const [fieldKey, label, type = "text", requiredValue = ""] = line.split("|").map((value) => value.trim());
          return {
            key: slugify(fieldKey ?? "field").replaceAll("-", "_"),
            label: label || fieldKey,
            fieldType: type,
            required: requiredValue.toLowerCase() === "required",
          };
        }),
      };
    }
    if (selectedType === "workflow") {
      return {
        entity,
        stages: parseLines(workflowStages).map((line, index) => {
          const requiresApproval = line.endsWith("*");
          const label = line.replace(/\*$/, "").trim();
          const palette = ["#64748b", "#0284c7", "#d97706", "#0f766e", "#16a34a"];
          return {
            key: slugify(label),
            label,
            color: palette[index % palette.length],
            requiresApproval,
          };
        }),
      };
    }
    if (selectedType === "formula") {
      return {
        entity,
        expression,
        variables: variables.split(",").map((value) => value.trim()).filter(Boolean),
        resultUnit,
        decimalPlaces,
      };
    }
    return {
      documentType,
      title: name,
      blocks,
      accentColor,
      footer: footer || undefined,
      showLogo,
    };
  }

  function resetEditor(type = selectedType) {
    setEditingId(undefined);
    setName("");
    setKey("");
    setEntity(type === "workflow" ? "project" : "project");
    setPlaceholder("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = { name, configuration: configuration() };
      if (editingId) {
        await apiRequest(`/operations/custom-definitions/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMessage("Draft updated successfully.");
      } else {
        await apiRequest("/operations/custom-definitions", {
          method: "POST",
          body: JSON.stringify({
            definitionType: selectedType,
            key: key || slugify(name),
            ...body,
          }),
        });
        setMessage("New draft created.");
      }
      resetEditor(selectedType);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save definition");
    } finally {
      setBusy(false);
    }
  }

  function edit(definition: CustomDefinition) {
    const config = definition.configuration;
    setSelectedType(definition.definitionType);
    setEditingId(definition._id);
    setName(definition.name);
    setKey(definition.key);
    setEntity(String(config.entity ?? "project"));
    setFieldType(String(config.fieldType ?? "text"));
    setRequired(Boolean(config.required));
    setPlaceholder(String(config.placeholder ?? config.description ?? ""));
    setOptionsText(Array.isArray(config.options) ? config.options.join(", ") : "");
    setColumns(Number(config.columns ?? 1));
    if (Array.isArray(config.fields)) {
      setFormFields((config.fields as Array<Record<string, unknown>>).map((field) =>
        `${field.key} | ${field.label} | ${field.fieldType} | ${field.required ? "required" : "optional"}`).join("\n"));
    }
    if (Array.isArray(config.stages)) {
      setWorkflowStages((config.stages as Array<Record<string, unknown>>).map((stage) =>
        `${stage.label}${stage.requiresApproval ? " *" : ""}`).join("\n"));
    }
    setExpression(String(config.expression ?? ""));
    setVariables(Array.isArray(config.variables) ? config.variables.join(", ") : "");
    setResultUnit(String(config.resultUnit ?? "number"));
    setDecimalPlaces(Number(config.decimalPlaces ?? 2));
    setDocumentType(String(config.documentType ?? "quotation"));
    setBlocks(Array.isArray(config.blocks) ? config.blocks.map(String) : []);
    setAccentColor(String(config.accentColor ?? "#0f766e"));
    setFooter(String(config.footer ?? ""));
    setShowLogo(Boolean(config.showLogo ?? true));
    setMessage(`Editing ${definition.name} v${definition.version}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function action(definition: CustomDefinition, operation: "activate" | "archive" | "duplicate") {
    setBusy(true);
    try {
      await apiRequest(`/operations/custom-definitions/${definition._id}/${operation}`, { method: "POST" });
      setMessage(
        operation === "duplicate"
          ? `Created a new draft version of ${definition.name}.`
          : `${definition.name} is now ${operation === "activate" ? "active" : "archived"}.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function exportDefinition(definition: CustomDefinition) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(definition, null, 2)], { type: "application/json" }),
    );
    link.download = `${definition.key}-v${definition.version}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importDefinition(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const definition = JSON.parse(await file.text()) as CustomDefinition;
      await apiRequest("/customization/import", {
        method: "POST",
        body: JSON.stringify({ definitionType: definition.definitionType, key: definition.key, name: definition.name, configuration: definition.configuration }),
      });
      setMessage(`${definition.name} imported as a new draft version.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import definition");
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  }

  const preview = configuration();

  return (
    <div className="mt-7 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {builderTypes.map(({ key: type, label, description, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setSelectedType(type);
              resetEditor(type);
              setMessage("");
            }}
            className={`rounded-2xl border p-4 text-left transition ${selectedType === type ? "border-brand-500 bg-brand-50 shadow-card" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <Icon size={20} className={selectedType === type ? "text-brand-700" : "text-slate-500"} />
            <b className="mt-3 block text-sm text-ink">{label}</b>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
          </button>
        ))}
      </section>

      {message && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">{message}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <form onSubmit={save} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Visual builder</p>
              <h2 className="mt-1 text-xl font-black capitalize text-ink">{editingId ? "Edit" : "Create"} {selectedType}</h2>
            </div>
            {editingId && (
              <button type="button" onClick={() => resetEditor()} className="text-xs font-bold text-slate-500">Cancel edit</button>
            )}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">
              Builder name
              <input value={name} onChange={(event) => { setName(event.target.value); if (!editingId) setKey(slugify(event.target.value)); }} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" placeholder="Site survey details" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Unique key
              <input value={key} onChange={(event) => setKey(slugify(event.target.value))} required disabled={Boolean(editingId)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal disabled:bg-slate-100" placeholder="site-survey-details" />
            </label>
          </div>

          {(selectedType === "field" || selectedType === "form" || selectedType === "formula") && (
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Applies to
              <select value={entity} onChange={(event) => setEntity(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal">
                {entities.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          )}

          {selectedType === "field" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Field type<select value={fieldType} onChange={(event) => setFieldType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal">{fieldTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="text-sm font-bold text-slate-700">Placeholder<input value={placeholder} onChange={(event) => setPlaceholder(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
              {fieldType === "select" && <label className="text-sm font-bold text-slate-700 sm:col-span-2">Choices, comma separated<input value={optionsText} onChange={(event) => setOptionsText(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" placeholder="Economy, Standard, Premium" /></label>}
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /> Required field</label>
            </div>
          )}

          {selectedType === "form" && (
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-bold text-slate-700">Description<input value={placeholder} onChange={(event) => setPlaceholder(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
              <label className="block text-sm font-bold text-slate-700">Columns<select value={columns} onChange={(event) => setColumns(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"><option value={1}>1 column</option><option value={2}>2 columns</option><option value={3}>3 columns</option></select></label>
              <label className="block text-sm font-bold text-slate-700">Fields, one per line<textarea value={formFields} onChange={(event) => setFormFields(event.target.value)} rows={6} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-xs font-normal" /><span className="mt-1 block text-xs font-normal text-slate-400">key | Label | text/number/date/select/checkbox/textarea | required/optional</span></label>
            </div>
          )}

          {selectedType === "workflow" && (
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-bold text-slate-700">Process type<select value={entity} onChange={(event) => setEntity(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal">{["project", "quote", "purchase", "production", "delivery", "installation", "service"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="block text-sm font-bold text-slate-700">Stages, one per line<textarea value={workflowStages} onChange={(event) => setWorkflowStages(event.target.value)} rows={7} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /><span className="mt-1 block text-xs font-normal text-slate-400">Add * after a stage that requires approval.</span></label>
            </div>
          )}

          {selectedType === "formula" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">Formula expression<input value={expression} onChange={(event) => setExpression(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono font-normal" /></label>
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">Variables, comma separated<input value={variables} onChange={(event) => setVariables(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
              <label className="text-sm font-bold text-slate-700">Result unit<input value={resultUnit} onChange={(event) => setResultUnit(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
              <label className="text-sm font-bold text-slate-700">Decimal places<input type="number" min={0} max={4} value={decimalPlaces} onChange={(event) => setDecimalPlaces(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
            </div>
          )}

          {selectedType === "document" && (
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-bold text-slate-700">Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal">{["quotation", "invoice", "delivery-note", "work-order", "completion-certificate"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <div><div className="text-sm font-bold text-slate-700">Visible sections</div><div className="mt-2 grid gap-2 sm:grid-cols-3">{documentBlocks.map((block) => <label key={block} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs capitalize"><input type="checkbox" checked={blocks.includes(block)} onChange={(event) => setBlocks((current) => event.target.checked ? [...current, block] : current.filter((value) => value !== block))} />{block}</label>)}</div></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Accent colour<input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 p-1" /></label><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={showLogo} onChange={(event) => setShowLogo(event.target.checked)} /> Show company logo</label></div>
              <label className="block text-sm font-bold text-slate-700">Footer<input value={footer} onChange={(event) => setFooter(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
            </div>
          )}

          <button disabled={busy} className="mt-6 flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-bold text-white disabled:opacity-50"><Plus size={17} />{editingId ? "Update draft" : "Save draft"}</button>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-card">
          <div className="flex items-center gap-2 text-emerald-300"><Play size={17} /><span className="text-xs font-bold uppercase tracking-wider">Live preview</span></div>
          <h2 className="mt-4 text-2xl font-black">{name || `Untitled ${selectedType}`}</h2>
          <p className="mt-1 text-sm text-slate-400">{key || "unique-key"} · {selectedType}</p>
          {selectedType === "field" && <div className="mt-6 rounded-xl bg-white p-4 text-slate-900"><label className="text-sm font-bold">{name || "Field label"}{required && " *"}<input disabled placeholder={placeholder} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label></div>}
          {selectedType === "form" && <div className={`mt-6 grid gap-3 rounded-xl bg-white p-4 text-slate-900 ${columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-1"}`}>{(preview.fields as Array<Record<string, unknown>>).map((field) => <label key={String(field.key)} className="text-xs font-bold">{String(field.label)}{Boolean(field.required) && " *"}<input disabled className="mt-1 w-full rounded border border-slate-300 px-2 py-2" /></label>)}</div>}
          {selectedType === "workflow" && <div className="mt-6 space-y-3">{(preview.stages as Array<Record<string, unknown>>).map((stage, index) => <div key={String(stage.key)} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full text-xs font-black" style={{ backgroundColor: String(stage.color) }}>{index + 1}</span><span className="font-bold">{String(stage.label)}</span>{Boolean(stage.requiresApproval) && <span className="rounded-full bg-amber-400/20 px-2 py-1 text-xs text-amber-200">Approval</span>}</div>)}</div>}
          {selectedType === "formula" && <div className="mt-6 rounded-xl bg-white/10 p-4"><div className="font-mono text-emerald-300">{expression}</div><div className="mt-3 text-xs text-slate-400">Variables: {variables || "none"} · result in {resultUnit}</div></div>}
          {selectedType === "document" && <div className="mt-6 rounded-xl bg-white p-5 text-slate-900" style={{ borderTop: `6px solid ${accentColor}` }}><div className="flex justify-between"><b>{name || "DOCUMENT TITLE"}</b>{showLogo && <span className="text-xs font-bold" style={{ color: accentColor }}>LOGO</span>}</div><div className="mt-5 space-y-2">{blocks.map((block) => <div key={block} className="rounded bg-slate-100 px-3 py-2 text-xs capitalize">{block} section</div>)}</div><div className="mt-5 text-center text-xs text-slate-500">{footer}</div></div>}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black text-ink">Saved {builderTypes.find((item) => item.key === selectedType)?.label}</h2><p className="mt-1 text-sm text-slate-500">Activate one version when it is ready for business use.</p></div>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"><Upload size={14} /> Import JSON<input type="file" accept="application/json,.json" onChange={(event) => void importDefinition(event)} className="hidden" /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="all">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {visibleDefinitions.map((definition) => (
            <article key={definition._id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-ink">{definition.name}</h3><p className="mt-1 text-xs text-slate-500">{definition.key} · version {definition.version}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${definition.status === "active" ? "bg-emerald-50 text-emerald-700" : definition.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{definition.status}</span></div>
              <div className="mt-4 flex flex-wrap gap-2">
                {definition.status === "draft" && <><button type="button" onClick={() => edit(definition)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Pencil size={13} /> Edit</button><button type="button" onClick={() => void action(definition, "activate")} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 size={13} /> Activate</button></>}
                <button type="button" onClick={() => void action(definition, "duplicate")} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Copy size={13} /> New version</button>
                {definition.status !== "archived" && <button type="button" onClick={() => void action(definition, "archive")} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Archive size={13} /> Archive</button>}
                <button type="button" onClick={() => exportDefinition(definition)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Download size={13} /> Export</button>
              </div>
            </article>
          ))}
          {!visibleDefinitions.length && <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500 lg:col-span-2">No {selectedType} definitions match this filter. Create the first draft above.</div>}
        </div>
      </section>
    </div>
  );
}
