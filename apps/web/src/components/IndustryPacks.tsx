import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Database,
  PackageCheck,
  Power,
  Ruler,
  Sparkles,
  Workflow,
} from "lucide-react";
import { apiRequest } from "../lib/api";

export type OrganizationIndustryPack = {
  key: string;
  name: string;
  description: string;
  version: number;
  color: string;
  installed: boolean;
  enabled: boolean;
  installedVersion?: number;
  requiredModules: string[];
  categories: Array<{
    key: string;
    name: string;
    itemType: string;
    defaultUnit: string;
  }>;
  measurementFields: Array<{
    key: string;
    label: string;
    unit: string;
    required: boolean;
  }>;
  formulas: Array<{
    key: string;
    label: string;
    expression: string;
    resultUnit: string;
  }>;
  bomRules: Array<{ categoryKey: string; rule: string }>;
  defaultWorkflow: string[];
  seedItems: Array<{ code: string; name: string }>;
};

export function IndustryPackManager() {
  const [packs, setPacks] = useState<OrganizationIndustryPack[]>([]);
  const [filter, setFilter] = useState<"all" | "installed" | "available">("all");
  const [expanded, setExpanded] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setPacks(
        await apiRequest<OrganizationIndustryPack[]>(
          "/organization/industry-packs",
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load industry packs",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      packs.filter((pack) =>
        filter === "all"
          ? true
          : filter === "installed"
            ? pack.installed
            : !pack.installed,
      ),
    [filter, packs],
  );

  async function install(pack: OrganizationIndustryPack, seedExamples: boolean) {
    setBusy(pack.key);
    try {
      await apiRequest(`/organization/industry-packs/${pack.key}/install`, {
        method: "POST",
        body: JSON.stringify({ seedExamples }),
      });
      setMessage(
        `${pack.name} installed${seedExamples ? " with editable example products and a draft rate card" : ""}.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to install pack");
    } finally {
      setBusy(undefined);
    }
  }

  async function toggle(pack: OrganizationIndustryPack) {
    setBusy(pack.key);
    try {
      await apiRequest(`/organization/industry-packs/${pack.key}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !pack.enabled }),
      });
      setMessage(`${pack.name} ${pack.enabled ? "disabled" : "enabled"}. Existing records remain unchanged.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update pack");
    } finally {
      setBusy(undefined);
    }
  }

  async function seed(pack: OrganizationIndustryPack) {
    setBusy(pack.key);
    try {
      await apiRequest(`/organization/industry-packs/${pack.key}/seed`, {
        method: "POST",
      });
      setMessage(`${pack.name} examples are ready in Products and Rate cards.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add examples");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
            Modular business setup
          </p>
          <h2 className="mt-1 text-2xl font-black text-ink">Industry packs</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Install only the businesses this organization needs. Packs add
            categories, measurements, formulas, workflows and optional example
            pricing without changing existing records.
          </p>
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
        >
          <option value="all">All packs</option>
          <option value="installed">Installed</option>
          <option value="available">Available</option>
        </select>
      </div>

      {message && (
        <div className="mt-5 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {visible.map((pack) => (
          <article
            key={pack.key}
            className={`overflow-hidden rounded-2xl border ${pack.enabled ? "border-emerald-200" : "border-slate-200"}`}
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-white"
                    style={{ backgroundColor: pack.color }}
                  >
                    <Boxes size={21} />
                  </span>
                  <div>
                    <h3 className="font-black text-ink">{pack.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {pack.description}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${pack.enabled ? "bg-emerald-50 text-emerald-700" : pack.installed ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}
                >
                  {pack.enabled ? "Enabled" : pack.installed ? "Disabled" : "Available"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2">
                  <b className="block text-ink">{pack.categories.length}</b>
                  Categories
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <b className="block text-ink">{pack.measurementFields.length}</b>
                  Measurements
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <b className="block text-ink">{pack.formulas.length}</b>
                  Formulas
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!pack.installed ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === pack.key}
                      onClick={() => void install(pack, false)}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      <PackageCheck size={14} /> Install pack
                    </button>
                    <button
                      type="button"
                      disabled={busy === pack.key}
                      onClick={() => void install(pack, true)}
                      className="flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-2 text-xs font-bold text-brand-700 disabled:opacity-50"
                    >
                      <Sparkles size={14} /> Install with examples
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy === pack.key}
                      onClick={() => void toggle(pack)}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      <Power size={14} /> {pack.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      disabled={busy === pack.key}
                      onClick={() => void seed(pack)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
                    >
                      <Database size={14} /> Add examples
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) =>
                      current === pack.key ? undefined : pack.key,
                    )
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                >
                  {expanded === pack.key ? "Hide details" : "View details"}
                </button>
              </div>
            </div>

            {expanded === pack.key && (
              <div className="border-t border-slate-100 bg-slate-50 p-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                    <Ruler size={14} /> Categories and units
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pack.categories.map((category) => (
                      <span
                        key={category.key}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        {category.name} · {category.defaultUnit}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                    <Workflow size={14} /> Default workflow
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {pack.defaultWorkflow.map((stage, index) => (
                      <span key={stage} className="flex items-center gap-1.5 text-xs">
                        <span className="rounded-lg bg-white px-2 py-1 font-semibold capitalize text-slate-600">
                          {stage.replaceAll("-", " ")}
                        </span>
                        {index < pack.defaultWorkflow.length - 1 && (
                          <span className="text-slate-300">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Version {pack.version} · {pack.seedItems.length} optional example
                  items · {pack.bomRules.length} BOM rules
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
