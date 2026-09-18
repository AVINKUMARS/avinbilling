import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  Building2,
  CircleDollarSign,
  Copy,
  Factory,
  FileText,
  Gauge,
  GitBranch,
  KeyRound,
  Layers3,
  LogOut,
  Menu,
  Package,
  Plus,
  ReceiptIndianRupee,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Trash2,
  Truck,
  Users,
  UserPlus,
  WandSparkles,
  X,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import type { QuotePdfData } from "./QuotePdf";
import type { InvoicePdfData } from "./InvoicePdf";
import { ConnectivityBadge } from "./ConnectivityBadge";
import { CustomBuilders } from "./CustomBuilders";
import {
  IndustryPackManager,
  type OrganizationIndustryPack,
} from "./IndustryPacks";
import { RuntimeFields, RuntimeRecordFields, extractCustomValues } from "./RuntimeFields";
import { useAuthStore } from "../store/auth-store";
import { ProjectCosting } from "./ProjectCosting";

type User = { id: string; name: string; email: string };
type Page =
  | "dashboard"
  | "customers"
  | "brands"
  | "products"
  | "rates"
  | "projects"
  | "measurements"
  | "quotations"
  | "purchasing"
  | "production"
  | "finance"
  | "logistics"
  | "reports"
  | "costing"
  | "customize"
  | "settings";
type Customer = {
  _id: string;
  clientCode: string;
  name: string;
  phone: string;
  email?: string;
  siteAddress?: string;
};
type Brand = {
  _id: string;
  name: string;
  code: string;
  companyName?: string;
  colors: string[];
  categories: string[];
};
type ProjectArea = {
  localId: string;
  parentLocalId?: string;
  name: string;
  type: "building" | "floor" | "room" | "area";
};
type Project = {
  _id: string;
  projectNumber: string;
  name: string;
  projectType: string;
  status: string;
  siteAddress?: string;
  clientId?: { name: string; phone: string };
  areas: ProjectArea[];
  customValues?: Record<string, unknown>;
  calculatedValues?: Record<string, number>;
  customWorkflow?: { currentStageKey?: string };
};
type CatalogItem = {
  _id: string;
  categoryKey: string;
  name: string;
  code: string;
  itemType: string;
  unit: string;
  brandId?: { name: string; code: string };
};
type RateCard = {
  _id: string;
  name: string;
  version: number;
  customerType: string;
  effectiveFrom: string;
  defaultWastagePercent: number;
  status: string;
  lines: Array<{
    catalogItemId?: CatalogItem;
    purchaseRatePaise: number;
    sellingRatePaise: number;
    wastagePercent: number;
  }>;
};
type MeasurementAttributes = {
  configurationType?: string;
  openingDirection?: string;
  color?: string;
  profileBrandId?: string;
  glassBrandId?: string;
  hardwareBrandId?: string;
  glassType?: string;
  profileSystem?: string;
  installationChargePaise?: number;
  transportChargePaise?: number;
  extraChargePaise?: number;
};
type Measurement = {
  _id: string;
  itemNumber: string;
  location: string;
  categoryKey: string;
  itemType: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  areaSqft: number;
  status: string;
  attributes?: MeasurementAttributes;
  projectId?: {
    _id: string;
    name: string;
    projectNumber: string;
    areas: ProjectArea[];
  };
  areaLocalId?: string;
  customValues?: Record<string, unknown>;
  calculatedValues?: Record<string, number>;
};
type Summary = {
  customers: number;
  projects: number;
  quotations: number;
  brands: number;
  outstandingPaise: number;
};
type ComparisonOption = {
  rateCardId: string;
  name: string;
  version: number;
  customerType: string;
  subtotalPaise: number;
  gstPercent: number;
  taxPaise: number;
  totalPaise: number;
  lines: Array<{
    itemNumber: string;
    location: string;
    productName: string;
    productCode: string;
    unit: string;
    billableQuantity: number;
    unitRatePaise: number;
    additionalChargesPaise?: number;
    totalPaise: number;
  }>;
};
type ThemeSettings = {
  primaryColor: string;
  sidebarColor: string;
  backgroundColor: string;
  surfaceColor: string;
  borderRadius: "compact" | "rounded" | "soft";
  density: "comfortable" | "compact";
  fontFamily: "system" | "modern" | "classic";
};

function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", theme.primaryColor);
  root.style.setProperty("--theme-sidebar", theme.sidebarColor);
  root.style.setProperty("--theme-background", theme.backgroundColor);
  root.style.setProperty("--theme-surface", theme.surfaceColor);
  root.style.setProperty(
    "--theme-font",
    theme.fontFamily === "classic"
      ? "Georgia, serif"
      : theme.fontFamily === "modern"
        ? "Inter, ui-sans-serif, system-ui, sans-serif"
        : "ui-sans-serif, system-ui, sans-serif",
  );
  const app = document.querySelector<HTMLElement>(".theme-app");
  if (app) {
    app.dataset.radius = theme.borderRadius;
    app.dataset.density = theme.density;
  }
  localStorage.setItem("avin_theme", JSON.stringify(theme));
}

const navItems: Array<{ key: Page; label: string; icon: typeof Gauge }> = [
  { key: "dashboard", label: "Dashboard", icon: Gauge },
  { key: "customers", label: "Customers", icon: Users },
  { key: "brands", label: "Brands & materials", icon: Tags },
  { key: "products", label: "Products", icon: Package },
  { key: "rates", label: "Rate cards", icon: CircleDollarSign },
  { key: "projects", label: "Projects", icon: Building2 },
  { key: "measurements", label: "Measurements", icon: Ruler },
  { key: "quotations", label: "Quotations", icon: FileText },
  { key: "purchasing", label: "Purchase & inventory", icon: ShoppingCart },
  { key: "production", label: "BOM & production", icon: Factory },
  { key: "finance", label: "Invoices & payments", icon: ReceiptIndianRupee },
  { key: "logistics", label: "Delivery & installation", icon: Truck },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "costing", label: "Project costing", icon: CircleDollarSign },
  { key: "customize", label: "Custom builders", icon: WandSparkles },
  { key: "settings", label: "Settings", icon: Settings },
];

async function downloadQuoteDocument(quote: QuotePdfData) {
  const { downloadQuotePdf } = await import("./QuotePdf");
  const [companySettings, template] = await Promise.all([
    apiRequest<NonNullable<QuotePdfData["companySettings"]>>("/organization/settings"),
    apiRequest<{ configuration: NonNullable<QuotePdfData["documentTemplate"]> } | null>("/customization/documents/quotation"),
  ]);
  await downloadQuotePdf({ ...quote, companySettings, documentTemplate: template?.configuration });
}
async function shareQuoteDocument(quote: QuotePdfData) {
  const { shareQuotePdf } = await import("./QuotePdf");
  const [companySettings, template] = await Promise.all([
    apiRequest<NonNullable<QuotePdfData["companySettings"]>>("/organization/settings"),
    apiRequest<{ configuration: NonNullable<QuotePdfData["documentTemplate"]> } | null>("/customization/documents/quotation"),
  ]);
  const shared = await shareQuotePdf({ ...quote, companySettings, documentTemplate: template?.configuration });
  if (!shared)
    throw new Error(
      "File sharing is not supported on this device. Use Download PDF and attach it in WhatsApp.",
    );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
    />
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl md:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Workspace({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [page, setPage] = useState<Page>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<
    | "customer"
    | "brand"
    | "product"
    | "rate"
    | "project"
    | "area"
    | "measurement"
    | null
  >(null);
  const [summary, setSummary] = useState<Summary>({
    customers: 0,
    projects: 0,
    quotations: 0,
    brands: 0,
    outstandingPaise: 0,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [quotes, setQuotes] = useState<QuotePdfData[]>([]);
  const [industryPacks, setIndustryPacks] = useState<
    OrganizationIndustryPack[]
  >([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = localStorage.getItem("avin_theme");
    if (cached) {
      try {
        applyTheme(JSON.parse(cached) as ThemeSettings);
      } catch {
        localStorage.removeItem("avin_theme");
      }
    }
    apiRequest<{ theme: ThemeSettings }>("/organization/settings")
      .then((value) => applyTheme(value.theme))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      setError("");
      const [
        nextSummary,
        nextCustomers,
        nextBrands,
        nextProjects,
        nextProducts,
        nextRateCards,
        nextMeasurements,
        nextQuotes,
        nextIndustryPacks,
      ] = await Promise.all([
        apiRequest<Summary>("/dashboard/summary"),
        apiRequest<Customer[]>("/clients"),
        apiRequest<Brand[]>("/brands"),
        apiRequest<Project[]>("/projects"),
        apiRequest<CatalogItem[]>("/catalog/items"),
        apiRequest<RateCard[]>("/catalog/rate-cards"),
        apiRequest<Measurement[]>("/measurements"),
        apiRequest<QuotePdfData[]>("/quotes"),
        apiRequest<OrganizationIndustryPack[]>("/organization/industry-packs"),
      ]);
      setSummary(nextSummary);
      setCustomers(nextCustomers);
      setBrands(nextBrands);
      setProjects(nextProjects);
      setProducts(nextProducts);
      setRateCards(nextRateCards);
      setMeasurements(nextMeasurements);
      setQuotes(nextQuotes);
      setIndustryPacks(nextIndustryPacks);
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to load workspace",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const reloadAfterSync = () => void load();
    window.addEventListener("avin:data-synced", reloadAfterSync);
    return () => window.removeEventListener("avin:data-synced", reloadAfterSync);
  }, [load]);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const created = await apiRequest<{ _id: string }>("/clients", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(data)),
    });
    const values = extractCustomValues(event.currentTarget);
    if (Object.keys(values).length)
      await apiRequest(`/customization/values/client/${created._id}`, {
        method: "PATCH",
        body: JSON.stringify({ values }),
      });
    setModal(null);
    await load();
  }
  async function createBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await apiRequest("/brands", {
      method: "POST",
      body: JSON.stringify({
        name: data.get("name"),
        code: data.get("code"),
        companyName: data.get("companyName"),
        colors: [],
        categories: ["upvc"],
      }),
    });
    setModal(null);
    await load();
  }
  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const created = await apiRequest<{ _id: string }>("/projects", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(data)),
    });
    const values = extractCustomValues(event.currentTarget);
    if (Object.keys(values).length)
      await apiRequest(`/customization/values/project/${created._id}`, {
        method: "PATCH",
        body: JSON.stringify({ values }),
      });
    setModal(null);
    await load();
  }
  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await apiRequest("/catalog/items", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(data)),
    });
    setModal(null);
    await load();
  }
  async function createRateCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await apiRequest("/catalog/rate-cards", {
      method: "POST",
      body: JSON.stringify({
        name: data.get("name"),
        customerType: data.get("customerType"),
        effectiveFrom: data.get("effectiveFrom"),
        defaultWastagePercent: Number(data.get("defaultWastagePercent")),
        lines: [
          {
            catalogItemId: data.get("catalogItemId"),
            purchaseRatePaise: Math.round(
              Number(data.get("purchaseRate")) * 100,
            ),
            sellingRatePaise: Math.round(Number(data.get("sellingRate")) * 100),
            wastagePercent: Number(data.get("wastagePercent")),
          },
        ],
      }),
    });
    setModal(null);
    await load();
  }
  async function createArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const projectId = String(data.get("projectId"));
    await apiRequest(`/projects/${projectId}/areas`, {
      method: "POST",
      body: JSON.stringify({
        name: data.get("name"),
        type: data.get("type"),
        parentLocalId: data.get("parentLocalId") || undefined,
      }),
    });
    setModal(null);
    await load();
  }
  async function createMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const unit = String(data.get("inputUnit"));
    const factor = unit === "inch" ? 25.4 : unit === "ft" ? 304.8 : 1;
    const created = await apiRequest<{ _id: string }>("/measurements", {
      method: "POST",
      body: JSON.stringify({
        projectId: data.get("projectId"),
        areaLocalId: data.get("areaLocalId") || undefined,
        location: data.get("location"),
        categoryKey: data.get("categoryKey"),
        itemType: data.get("itemType"),
        widthMm: Math.round(Number(data.get("width")) * factor),
        heightMm: Math.round(Number(data.get("height")) * factor),
        quantity: Number(data.get("quantity")),
        notes: data.get("notes") || undefined,
        attributes: {
          configurationType: data.get("configurationType") || undefined,
          openingDirection: data.get("openingDirection") || undefined,
          color: data.get("color") || undefined,
          profileSystem: data.get("profileSystem") || undefined,
          glassType: data.get("glassType") || undefined,
          profileBrandId: data.get("profileBrandId") || undefined,
          glassBrandId: data.get("glassBrandId") || undefined,
          hardwareBrandId: data.get("hardwareBrandId") || undefined,
          installationChargePaise: Math.round(
            Number(data.get("installationCharge") || 0) * 100,
          ),
          transportChargePaise: Math.round(
            Number(data.get("transportCharge") || 0) * 100,
          ),
          extraChargePaise: Math.round(
            Number(data.get("extraCharge") || 0) * 100,
          ),
        },
      }),
    });
    const values = extractCustomValues(event.currentTarget);
    if (Object.keys(values).length)
      await apiRequest(`/customization/values/measurement/${created._id}`, {
        method: "PATCH",
        body: JSON.stringify({ values }),
      });
    setModal(null);
    await load();
  }

  const titles: Record<Page, [string, string]> = {
    dashboard: ["Business overview", "Live information from your organization"],
    customers: ["Customers", "Manage clients and project locations"],
    brands: ["Brands & materials", "Configure manufacturers used in estimates"],
    projects: ["Projects", "Buildings, floors, rooms and work packages"],
    products: [
      "Products & materials",
      "Components, hardware, services and selling units",
    ],
    rates: ["Rate cards", "Versioned purchase and selling prices"],
    measurements: [
      "Site measurements",
      "Capture dimensions once and compare multiple brands",
    ],
    quotations: ["Quotations", "Compare brands and prepare customer proposals"],
    settings: ["Settings", "Organization modules, documents and workflows"],
    purchasing: [
      "Purchase & inventory",
      "Suppliers, purchase orders and material stock",
    ],
    production: [
      "BOM & production",
      "Factory requirements and production progress",
    ],
    finance: ["Invoices & payments", "GST documents, advances and balances"],
    logistics: [
      "Delivery & installation",
      "Schedules, dispatch and site completion",
    ],
    reports: ["Reports", "Sales, collection, purchase and stock performance"],
    costing: ["Project costing", "Budgets, actual expenses, variations and project profit"],
    customize: [
      "Custom builders",
      "Forms, fields, formulas, workflows and documents",
    ],
  };

  return (
    <main className="theme-app min-h-screen bg-canvas lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={`${menuOpen ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"} theme-sidebar h-screen w-64 flex-col overflow-hidden bg-slate-950 p-4 text-white lg:sticky lg:top-0 lg:flex`}
      >
        <div className="shrink-0 flex items-center gap-3 px-2 py-3">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-500">
            <Layers3 size={21} />
          </div>
          <div>
            <div className="font-extrabold">Avin Business Suite</div>
            <div className="text-xs text-slate-400">Organization workspace</div>
          </div>
        </div>
        <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setPage(key);
                setMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${page === key ? "bg-brand-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-3 shrink-0 rounded-xl bg-white/5 p-3">
          <div className="text-sm font-bold">{user.name}</div>
          <div className="truncate text-xs text-slate-400">{user.email}</div>
          <button
            onClick={onLogout}
            className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
          <button
            onClick={() => setMenuOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-slate-200 lg:hidden"
          >
            <Menu size={19} />
          </button>
          <div className="hidden items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-500 sm:flex">
            <Search size={16} /> Search workspace
          </div>
          <div className="flex items-center gap-3">
            <ConnectivityBadge />
            <div className="hidden text-sm font-bold text-slate-700 sm:block">
              {user.name}
            </div>
          </div>
        </header>
        <div className="p-5 lg:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold text-brand-600">Workspace</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">
                {titles[page][0]}
              </h1>
              <p className="mt-2 text-slate-600">{titles[page][1]}</p>
            </div>
            {page === "customers" && (
              <button
                onClick={() => setModal("customer")}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
              >
                <Plus size={17} /> Add customer
              </button>
            )}
            {page === "brands" && (
              <button
                onClick={() => setModal("brand")}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
              >
                <Plus size={17} /> Add brand
              </button>
            )}
            {page === "products" && (
              <button
                onClick={() => setModal("product")}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
              >
                <Plus size={17} /> Add product
              </button>
            )}
            {page === "rates" && (
              <button
                onClick={() => setModal("rate")}
                disabled={!products.length}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                <Plus size={17} /> Add rate card
              </button>
            )}
            {page === "projects" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setModal("area")}
                  disabled={!projects.length}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-40"
                >
                  Add floor / room
                </button>
                <button
                  onClick={() => setModal("project")}
                  disabled={!customers.length}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  <Plus size={17} /> Add project
                </button>
              </div>
            )}
            {page === "measurements" && (
              <button
                onClick={() => setModal("measurement")}
                disabled={!projects.length}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                <Ruler size={17} /> Add measurement
              </button>
            )}
          </div>
          {error && (
            <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}
          {page === "dashboard" && (
            <Dashboard summary={summary} setPage={setPage} />
          )}
          {page === "customers" && (
            <Table
              headers={["Code", "Customer", "Phone", "Site"]}
              rows={customers.map((item) => [
                item.clientCode,
                item.name,
                item.phone,
                item.siteAddress || "—",
              ])}
              empty="No customers yet. Add the first customer to begin a project."
            />
          )}
          {page === "brands" && (
            <Table
              headers={["Code", "Brand", "Company", "Category"]}
              rows={brands.map((item) => [
                item.code,
                item.name,
                item.companyName || "—",
                item.categories.join(", ") || "—",
              ])}
              empty="No brands yet. Add UPVC, hardware, glass or board brands."
            />
          )}
          {page === "products" && (
            <Table
              headers={["Code", "Product", "Category", "Type", "Unit", "Brand"]}
              rows={products.map((item) => [
                item.code,
                item.name,
                item.categoryKey,
                item.itemType,
                item.unit,
                item.brandId?.name || "Generic",
              ])}
              empty="No products yet. Add profiles, glass, hardware, labour or services."
            />
          )}
          {page === "rates" && (
            <RateCardList cards={rateCards} onChanged={load} />
          )}
          {page === "projects" && (
            <Table
              headers={[
                "Number",
                "Project",
                "Customer",
                "Type",
                "Structure",
                "Status",
              ]}
              rows={projects.map((item) => [
                item.projectNumber,
                item.name,
                item.clientId?.name || "—",
                item.projectType,
                `${item.areas?.length ?? 0} areas`,
                item.status,
              ])}
              empty="No projects yet. Add a customer first, then create a project."
            />
          )}
          {page === "measurements" && (
            <MeasurementList
              measurements={measurements}
              brands={brands}
              onChanged={load}
            />
          )}
          {page === "quotations" && (
            <ComparisonWorkspace
              measurements={measurements}
              rateCards={rateCards}
              quotes={quotes}
              onSaved={load}
            />
          )}
          {page === "settings" && <SettingsPage brands={brands.length} />}
          {page === "purchasing" && (
            <OperationsPanel
              kind="purchasing"
              projects={projects}
              products={products}
            />
          )}
          {page === "production" && (
            <OperationsPanel
              kind="production"
              projects={projects}
              products={products}
            />
          )}
          {page === "finance" && (
            <OperationsPanel
              kind="finance"
              projects={projects}
              products={products}
            />
          )}
          {page === "logistics" && (
            <OperationsPanel
              kind="logistics"
              projects={projects}
              products={products}
            />
          )}
          {page === "reports" && (
            <OperationsPanel
              kind="reports"
              projects={projects}
              products={products}
            />
          )}
          {page === "costing" && <ProjectCosting projects={projects} />}
          {page === "customize" && (
            <OperationsPanel
              kind="customize"
              projects={projects}
              products={products}
            />
          )}
        </div>
      </section>
      {modal === "customer" && (
        <Modal title="Add customer" onClose={() => setModal(null)}>
          <form onSubmit={createCustomer} className="mt-6 space-y-4">
            <Field label="Customer name">
              <Input name="name" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <Input name="phone" required />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" />
              </Field>
            </div>
            <Field label="Site address">
              <Input name="siteAddress" />
            </Field>
            <RuntimeFields entity="project" />
            <Submit />
          </form>
        </Modal>
      )}
      {modal === "brand" && (
        <Modal title="Add brand" onClose={() => setModal(null)}>
          <form onSubmit={createBrand} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand name">
                <Input name="name" required />
              </Field>
              <Field label="Brand code">
                <Input name="code" required />
              </Field>
            </div>
            <Field label="Company name">
              <Input name="companyName" />
            </Field>
            <Submit />
          </form>
        </Modal>
      )}
      {modal === "product" && (
        <Modal title="Add product or material" onClose={() => setModal(null)}>
          <form onSubmit={createProduct} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input name="name" required />
              </Field>
              <Field label="Code">
                <Input name="code" required />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Input
                  name="categoryKey"
                  placeholder="upvc-profile, glass, hardware"
                  required
                />
              </Field>
              <Field label="Brand">
                <select
                  name="brandId"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Generic / no brand</option>
                  {brands.map((brand) => (
                    <option key={brand._id} value={brand._id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Item type">
                <select
                  name="itemType"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="material">Material</option>
                  <option value="component">Component</option>
                  <option value="hardware">Hardware</option>
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                </select>
              </Field>
              <Field label="Selling unit">
                <select
                  name="unit"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="rft">Running foot</option>
                  <option value="sqft">Square foot</option>
                  <option value="qty">Quantity</option>
                  <option value="bar">Bar</option>
                  <option value="sheet">Sheet</option>
                  <option value="kg">Kilogram</option>
                  <option value="fixed">Fixed</option>
                </select>
              </Field>
            </div>
            <Submit />
          </form>
        </Modal>
      )}
      {modal === "rate" && (
        <Modal
          title="Create multi-item rate card"
          onClose={() => setModal(null)}
        >
          <RateCardForm
            products={products}
            onSaved={async () => {
              setModal(null);
              await load();
            }}
          />
        </Modal>
      )}
      {modal === "project" && (
        <Modal title="Create project" onClose={() => setModal(null)}>
          <form onSubmit={createProject} className="mt-6 space-y-4">
            <Field label="Project name">
              <Input name="name" required />
            </Field>
            <Field label="Customer">
              <select
                name="clientId"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name} — {customer.phone}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Project type">
              <select
                name="projectType"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option>UPVC Windows and Doors</option>
                <option>Complete Building</option>
                <option>Kitchen</option>
                <option>Wardrobe</option>
                <option>Interior Project</option>
              </select>
            </Field>
            <Field label="Site address">
              <Input name="siteAddress" />
            </Field>
            <RuntimeFields entity="client" />
            <Submit />
          </form>
        </Modal>
      )}
      {modal === "area" && (
        <Modal
          title="Add building, floor or room"
          onClose={() => setModal(null)}
        >
          <form onSubmit={createArea} className="mt-6 space-y-4">
            <Field label="Project">
              <select
                name="projectId"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectNumber} — {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  name="name"
                  placeholder="Ground Floor or Kitchen"
                  required
                />
              </Field>
              <Field label="Area type">
                <select
                  name="type"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="building">Building / Block</option>
                  <option value="floor">Floor</option>
                  <option value="room">Room</option>
                  <option value="area">Area</option>
                </select>
              </Field>
            </div>
            <Field label="Parent area (optional)">
              <select
                name="parentLocalId"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">No parent</option>
                {projects.flatMap((project) =>
                  (project.areas ?? []).map((area) => (
                    <option
                      key={`${project._id}-${area.localId}`}
                      value={area.localId}
                    >
                      {project.name} / {area.name} ({area.type})
                    </option>
                  )),
                )}
              </select>
            </Field>
            <p className="text-xs leading-5 text-slate-500">
              Create the building first, then floors under the building, and
              rooms under each floor.
            </p>
            <Submit />
          </form>
        </Modal>
      )}
      {modal === "measurement" && (
        <Modal title="Add detailed measurement" onClose={() => setModal(null)}>
          <form onSubmit={createMeasurement} className="mt-6 space-y-4">
            <Field label="Project">
              <select
                name="projectId"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectNumber} — {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Room or area">
              <select
                name="areaLocalId"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Project level</option>
                {projects.flatMap((project) =>
                  (project.areas ?? []).map((area) => (
                    <option
                      key={`${project._id}-${area.localId}`}
                      value={area.localId}
                    >
                      {project.name} / {area.name}
                    </option>
                  )),
                )}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location">
                <Input
                  name="location"
                  placeholder="Living Room - East Wall"
                  required
                />
              </Field>
              <Field label="Configuration">
                <select
                  name="configurationType"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option>2 Track Sliding</option>
                  <option>3 Track Sliding</option>
                  <option>Casement</option>
                  <option>Fixed</option>
                  <option>Top Hung</option>
                  <option>French Door</option>
                  <option>Custom</option>
                </select>
              </Field>
              <Field label="Item type">
                <Input
                  name="itemType"
                  placeholder="Window or door"
                  defaultValue="UPVC Window"
                  required
                />
              </Field>
              <Field label="Opening">
                <select
                  name="openingDirection"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="both">Both</option>
                  <option value="fixed">Fixed</option>
                  <option value="top">Top</option>
                  <option value="inside">Inside</option>
                  <option value="outside">Outside</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select
                  name="categoryKey"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  {industryPacks
                    .filter((pack) => pack.enabled)
                    .flatMap((pack) => pack.categories)
                    .filter(
                      (category, index, categories) =>
                        categories.findIndex(
                          (candidate) => candidate.key === category.key,
                        ) === index,
                    )
                    .map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.name}
                      </option>
                    ))}
                  <option value="custom">Custom</option>
                </select>
              </Field>
              <Field label="Input unit">
                <select
                  name="inputUnit"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="mm">Millimetres</option>
                  <option value="inch">Inches</option>
                  <option value="ft">Feet</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Width">
                <Input
                  name="width"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  required
                />
              </Field>
              <Field label="Height">
                <Input
                  name="height"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  required
                />
              </Field>
              <Field label="Quantity">
                <Input
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  defaultValue="1"
                  required
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Profile system">
                <Input name="profileSystem" placeholder="60mm / 2.5 track" />
              </Field>
              <Field label="Glass type">
                <Input name="glassType" placeholder="5mm toughened" />
              </Field>
              <Field label="Colour">
                <Input name="color" placeholder="White / walnut" />
              </Field>
              <Field label="Profile brand">
                <select
                  name="profileBrandId"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Use rate-card brand</option>
                  {brands.map((brand) => (
                    <option key={brand._id} value={brand._id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Glass brand">
                <select
                  name="glassBrandId"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Use rate-card brand</option>
                  {brands.map((brand) => (
                    <option key={brand._id} value={brand._id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hardware brand">
                <select
                  name="hardwareBrandId"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Use rate-card brand</option>
                  {brands.map((brand) => (
                    <option key={brand._id} value={brand._id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Installation ₹">
                <Input
                  name="installationCharge"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </Field>
              <Field label="Transport ₹">
                <Input
                  name="transportCharge"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </Field>
              <Field label="Other ₹">
                <Input
                  name="extraCharge"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </Field>
            </div>
            <Field label="Site notes">
              <Input
                name="notes"
                placeholder="Wall condition and customer request"
              />
            </Field>
            <RuntimeFields entity="measurement" />
            <Submit />
          </form>
        </Modal>
      )}
    </main>
  );
}

function Submit() {
  return (
    <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 font-bold text-white">
      <Plus size={17} /> Save
    </button>
  );
}
type EditableRateLine = {
  catalogItemId: string;
  purchaseRate: string;
  sellingRate: string;
  wastagePercent: string;
};
function RateCardForm({
  products,
  onSaved,
}: {
  products: CatalogItem[];
  onSaved: () => Promise<void>;
}) {
  const blank = (): EditableRateLine => ({
    catalogItemId: products[0]?._id ?? "",
    purchaseRate: "",
    sellingRate: "",
    wastagePercent: "0",
  });
  const [lines, setLines] = useState<EditableRateLine[]>([blank()]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const updateLine = (
    index: number,
    key: keyof EditableRateLine,
    value: string,
  ) =>
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest("/catalog/rate-cards", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          customerType: data.get("customerType"),
          effectiveFrom: data.get("effectiveFrom"),
          defaultWastagePercent: Number(data.get("defaultWastagePercent")),
          lines: lines.map((line) => ({
            catalogItemId: line.catalogItemId,
            purchaseRatePaise: Math.round(Number(line.purchaseRate) * 100),
            sellingRatePaise: Math.round(Number(line.sellingRate) * 100),
            wastagePercent: Number(line.wastagePercent),
          })),
        }),
      });
      await onSaved();
    } catch (problem) {
      setMessage(
        problem instanceof Error
          ? problem.message
          : "Unable to create rate card",
      );
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rate card name">
          <Input name="name" placeholder="UPVC Retail" required />
        </Field>
        <Field label="Customer type">
          <select
            name="customerType"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          >
            <option value="retail">Retail</option>
            <option value="dealer">Dealer</option>
            <option value="builder">Builder</option>
            <option value="project">Project</option>
            <option value="custom">Custom</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Effective from">
          <Input
            name="effectiveFrom"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </Field>
        <Field label="Default wastage %">
          <Input
            name="defaultWastagePercent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue="10"
            required
          />
        </Field>
      </div>
      <div className="border-t border-slate-200 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black text-ink">Products and prices</h3>
          <button
            type="button"
            onClick={() => setLines((current) => [...current, blank()])}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
          >
            <Plus className="mr-1 inline" size={14} />
            Add item
          </button>
        </div>
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex gap-2">
                <select
                  value={line.catalogItemId}
                  onChange={(event) =>
                    updateLine(index, "catalogItemId", event.target.value)
                  }
                  required
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {products.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.code} — {item.name} / {item.unit}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((_, lineIndex) => lineIndex !== index),
                    )
                  }
                  className="grid size-10 place-items-center rounded-lg text-red-600 disabled:opacity-30"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Input
                  aria-label={`Purchase price ${index + 1}`}
                  value={line.purchaseRate}
                  onChange={(event) =>
                    updateLine(index, "purchaseRate", event.target.value)
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Purchase ₹"
                  required
                />
                <Input
                  aria-label={`Selling price ${index + 1}`}
                  value={line.sellingRate}
                  onChange={(event) =>
                    updateLine(index, "sellingRate", event.target.value)
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Selling ₹"
                  required
                />
                <Input
                  aria-label={`Wastage ${index + 1}`}
                  value={line.wastagePercent}
                  onChange={(event) =>
                    updateLine(index, "wastagePercent", event.target.value)
                  }
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Waste %"
                  required
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {message && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}
      <button
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 font-bold text-white disabled:opacity-50"
      >
        <Plus size={17} />
        {saving ? "Saving…" : `Save ${lines.length}-item rate card`}
      </button>
    </form>
  );
}
function RateCardList({
  cards,
  onChanged,
}: {
  cards: RateCard[];
  onChanged: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const money = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(paise / 100);
  async function activate(id: string) {
    try {
      await apiRequest(`/catalog/rate-cards/${id}/activate`, {
        method: "POST",
      });
      await onChanged();
    } catch (problem) {
      setMessage(
        problem instanceof Error ? problem.message : "Unable to activate",
      );
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this draft rate card?")) return;
    try {
      await apiRequest(`/catalog/rate-cards/${id}`, { method: "DELETE" });
      await onChanged();
    } catch (problem) {
      setMessage(
        problem instanceof Error ? problem.message : "Unable to delete",
      );
    }
  }
  if (!cards.length)
    return (
      <Empty
        icon={CircleDollarSign}
        title="No rate cards yet"
        text="Add products first, then create a rate card containing all required materials and prices."
      />
    );
  return (
    <div className="mt-7 space-y-4">
      {message && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}
      {cards.map((card) => (
        <article
          key={card._id}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink">{card.name}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${card.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {card.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Version {card.version} · {card.customerType} · effective{" "}
                {new Date(card.effectiveFrom).toLocaleDateString("en-IN")}
              </p>
            </div>
            <div className="flex gap-2">
              {card.status === "draft" && (
                <>
                  <button
                    onClick={() => void activate(card._id)}
                    className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => void remove(card._id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Item</th>
                  <th>Purchase</th>
                  <th>Selling</th>
                  <th>Waste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {card.lines.map((line, index) => (
                  <tr key={index}>
                    <td className="py-3 font-bold text-ink">
                      {line.catalogItemId?.code} — {line.catalogItemId?.name}
                    </td>
                    <td>{money(line.purchaseRatePaise)}</td>
                    <td>{money(line.sellingRatePaise)}</td>
                    <td>{line.wastagePercent ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </div>
  );
}
function MeasurementList({
  measurements,
  brands,
  onChanged,
}: {
  measurements: Measurement[];
  brands: Brand[];
  onChanged: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const brandName = (id?: string) =>
    brands.find((brand) => brand._id === id)?.name;
  async function duplicate(id: string) {
    try {
      await apiRequest(`/measurements/${id}/duplicate`, { method: "POST" });
      await onChanged();
    } catch (problem) {
      setMessage(
        problem instanceof Error ? problem.message : "Unable to duplicate",
      );
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this measurement?")) return;
    try {
      await apiRequest(`/measurements/${id}`, { method: "DELETE" });
      await onChanged();
    } catch (problem) {
      setMessage(
        problem instanceof Error ? problem.message : "Unable to delete",
      );
    }
  }
  async function edit(item: Measurement) {
    const location = window.prompt("Location", item.location);
    if (!location) return;
    const width = window.prompt("Width in millimetres", String(item.widthMm));
    if (!width) return;
    const height = window.prompt(
      "Height in millimetres",
      String(item.heightMm),
    );
    if (!height) return;
    try {
      await apiRequest(`/measurements/${item._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          location,
          widthMm: Number(width),
          heightMm: Number(height),
        }),
      });
      await onChanged();
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "Unable to edit");
    }
  }
  if (!measurements.length)
    return (
      <Empty
        icon={Ruler}
        title="No measurements yet"
        text="Create a project and its rooms, then capture the first detailed measurement."
      />
    );
  return (
    <div className="mt-7 space-y-4">
      {message && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}
      {measurements.map((item) => (
        <article
          key={item._id}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-black text-ink">
                  {item.itemNumber} · {item.location}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {item.projectId?.name} ·{" "}
                {item.attributes?.configurationType ?? item.itemType}
              </p>
            </div>
            {item.status !== "locked" && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void edit(item)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                >
                  Edit size
                </button>
                <button
                  onClick={() => void duplicate(item._id)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => void remove(item._id)}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="block text-xs text-slate-500">Dimensions</span>
              <b>
                {item.widthMm} × {item.heightMm} mm · {item.quantity} qty
              </b>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="block text-xs text-slate-500">Area</span>
              <b>{item.areaSqft.toFixed(2)} sqft each</b>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="block text-xs text-slate-500">
                Specification
              </span>
              <b>
                {item.attributes?.profileSystem || "Standard"} ·{" "}
                {item.attributes?.glassType || "Standard glass"}
              </b>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="block text-xs text-slate-500">Mixed brands</span>
              <b>
                {[
                  brandName(item.attributes?.profileBrandId),
                  brandName(item.attributes?.glassBrandId),
                  brandName(item.attributes?.hardwareBrandId),
                ]
                  .filter(Boolean)
                  .join(" / ") || "Rate card defaults"}
              </b>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-5 py-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-5 py-4 ${j === 1 ? "font-bold text-ink" : "text-slate-600"}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center text-sm text-slate-500">{empty}</div>
      )}
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof FileText;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <Icon className="mx-auto text-brand-600" size={36} />
      <h2 className="mt-4 text-xl font-black text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">{text}</p>
    </div>
  );
}
function Dashboard({
  summary,
  setPage,
}: {
  summary: Summary;
  setPage: (page: Page) => void;
}) {
  const cards = [
    [Users, "Customers", summary.customers],
    [Building2, "Active projects", summary.projects],
    [FileText, "Open quotations", summary.quotations],
    [Tags, "Configured brands", summary.brands],
  ] as const;
  return (
    <>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([Icon, label, value]) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-center justify-between text-sm font-bold text-slate-600">
              {label}
              <Icon className="text-brand-600" size={20} />
            </div>
            <div className="mt-5 text-3xl font-black text-ink">{value}</div>
          </article>
        ))}
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <button
          onClick={() => setPage("customers")}
          className="rounded-2xl bg-slate-900 p-6 text-left text-white"
        >
          <Users />
          <h2 className="mt-6 text-xl font-black">Add your first customer</h2>
          <p className="mt-2 text-sm text-slate-300">
            Create the client record used by projects, quotations and invoices.
          </p>
        </button>
        <button
          onClick={() => setPage("brands")}
          className="rounded-2xl bg-brand-600 p-6 text-left text-white"
        >
          <Package />
          <h2 className="mt-6 text-xl font-black">
            Configure brands and materials
          </h2>
          <p className="mt-2 text-sm text-brand-50">
            Prepare manufacturers and materials for comparison quotations.
          </p>
        </button>
      </div>
    </>
  );
}
type OrganizationSettings = {
  companyProfile: {
    legalName: string;
    tradeName?: string;
    proprietorName?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    phones: string[];
    email?: string;
    gstin?: string;
    pan?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
  };
  documents: {
    quotationTitle: string;
    invoiceTitle: string;
    productTagline?: string;
    deliveryTerms?: string;
    paymentTerms?: string;
    warrantyTerms?: string;
    footerText?: string;
    authorisedSignatory?: string;
    primaryColor: string;
    showGst: boolean;
  };
  theme: ThemeSettings;
};
function SettingsPage({ brands }: { brands: number }) {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    apiRequest<OrganizationSettings>("/organization/settings")
      .then(setSettings)
      .catch((e) =>
        setMessage(e instanceof Error ? e.message : "Unable to load settings"),
      );
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: OrganizationSettings = {
      companyProfile: {
        legalName: String(data.get("legalName")),
        tradeName: String(data.get("tradeName")),
        proprietorName: String(data.get("proprietorName")),
        address: String(data.get("address")),
        city: String(data.get("city")),
        state: String(data.get("state")),
        postalCode: String(data.get("postalCode")),
        phones: String(data.get("phones"))
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        email: String(data.get("email")),
        gstin: String(data.get("gstin")),
        pan: String(data.get("pan")),
        bankName: String(data.get("bankName")),
        accountNumber: String(data.get("accountNumber")),
        ifsc: String(data.get("ifsc")),
        upiId: String(data.get("upiId")),
      },
      documents: {
        quotationTitle: String(data.get("quotationTitle")),
        invoiceTitle: String(data.get("invoiceTitle")),
        productTagline: String(data.get("productTagline")),
        deliveryTerms: String(data.get("deliveryTerms")),
        paymentTerms: String(data.get("paymentTerms")),
        warrantyTerms: String(data.get("warrantyTerms")),
        footerText: String(data.get("footerText")),
        authorisedSignatory: String(data.get("authorisedSignatory")),
        primaryColor: String(data.get("primaryColor")),
        showGst: data.get("showGst") === "on",
      },
      theme: {
        primaryColor: String(data.get("themePrimaryColor")),
        sidebarColor: String(data.get("sidebarColor")),
        backgroundColor: String(data.get("backgroundColor")),
        surfaceColor: String(data.get("surfaceColor")),
        borderRadius: data.get("borderRadius") as ThemeSettings["borderRadius"],
        density: data.get("density") as ThemeSettings["density"],
        fontFamily: data.get("fontFamily") as ThemeSettings["fontFamily"],
      },
    };
    try {
      await apiRequest("/organization/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      setSettings(input);
      applyTheme(input.theme);
      setMessage("Settings and software theme saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    }
  }
  if (!settings)
    return (
      <div className="mt-7 rounded-2xl bg-white p-8 text-sm text-slate-500">
        Loading editable company settings… {message}
      </div>
    );
  const p = settings.companyProfile;
  const d = settings.documents;
  const t = settings.theme;
  return (
    <div className="mt-7 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Organization", "Editable company, GST, bank and document details"],
          ["Modules", "Enable business capabilities and dependencies"],
          ["Industry packs", `Business-specific defaults · ${brands} brands configured`],
          ["Users & roles", "Permissions for office, factory and installation"],
          ["Number sequences", "Quotation, order and invoice numbering"],
          ["Audit history", "Protected record of important changes"],
        ].map(([title, text]) => (
          <article
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
          >
            <h3 className="font-black text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
      <IndustryPackManager />
      <form
        onSubmit={save}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card md:p-8"
      >
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
            Appearance
          </p>
          <h2 className="mt-1 text-2xl font-black text-ink">Software theme</h2>
          <p className="mt-2 text-sm text-slate-500">
            Customize colours, spacing, corners and typography for this
            organization.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Action colour">
            <Input
              name="themePrimaryColor"
              type="color"
              defaultValue={t.primaryColor}
            />
          </Field>
          <Field label="Sidebar colour">
            <Input
              name="sidebarColor"
              type="color"
              defaultValue={t.sidebarColor}
            />
          </Field>
          <Field label="Page background">
            <Input
              name="backgroundColor"
              type="color"
              defaultValue={t.backgroundColor}
            />
          </Field>
          <Field label="Card background">
            <Input
              name="surfaceColor"
              type="color"
              defaultValue={t.surfaceColor}
            />
          </Field>
          <Field label="Corner style">
            <select
              name="borderRadius"
              defaultValue={t.borderRadius}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              <option value="compact">Compact</option>
              <option value="rounded">Rounded</option>
              <option value="soft">Extra soft</option>
            </select>
          </Field>
          <Field label="Layout density">
            <select
              name="density"
              defaultValue={t.density}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </Field>
          <Field label="Font style">
            <select
              name="fontFamily"
              defaultValue={t.fontFamily}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              <option value="system">System</option>
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
            </select>
          </Field>
        </div>
        <div className="my-8 border-t border-slate-200" />
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
            Based on the supplied examples
          </p>
          <h2 className="mt-1 text-2xl font-black text-ink">
            Company and document settings
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Every value below is editable. Verify GST and legal information
            before issuing documents.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Legal name">
            <Input name="legalName" defaultValue={p.legalName} required />
          </Field>
          <Field label="Trade name">
            <Input name="tradeName" defaultValue={p.tradeName} />
          </Field>
          <Field label="Proprietor / signatory">
            <Input name="proprietorName" defaultValue={p.proprietorName} />
          </Field>
          <Field label="Phone numbers, comma separated">
            <Input name="phones" defaultValue={p.phones.join(", ")} />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={p.address} />
          </Field>
          <Field label="City">
            <Input name="city" defaultValue={p.city} />
          </Field>
          <Field label="State">
            <Input name="state" defaultValue={p.state} />
          </Field>
          <Field label="Postal code">
            <Input name="postalCode" defaultValue={p.postalCode} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={p.email} />
          </Field>
          <Field label="GSTIN">
            <Input name="gstin" defaultValue={p.gstin} />
          </Field>
          <Field label="PAN">
            <Input name="pan" defaultValue={p.pan} />
          </Field>
          <Field label="UPI ID">
            <Input name="upiId" defaultValue={p.upiId} />
          </Field>
          <Field label="Bank name">
            <Input name="bankName" defaultValue={p.bankName} />
          </Field>
          <Field label="Account number">
            <Input name="accountNumber" defaultValue={p.accountNumber} />
          </Field>
          <Field label="IFSC">
            <Input name="ifsc" defaultValue={p.ifsc} />
          </Field>
          <Field label="Document colour">
            <Input
              name="primaryColor"
              type="color"
              defaultValue={d.primaryColor}
            />
          </Field>
          <Field label="Quotation title">
            <Input name="quotationTitle" defaultValue={d.quotationTitle} />
          </Field>
          <Field label="Invoice title">
            <Input name="invoiceTitle" defaultValue={d.invoiceTitle} />
          </Field>
          <Field label="Product tagline">
            <Input name="productTagline" defaultValue={d.productTagline} />
          </Field>
          <Field label="Authorised signatory">
            <Input
              name="authorisedSignatory"
              defaultValue={d.authorisedSignatory}
            />
          </Field>
          <Field label="Delivery terms">
            <Input name="deliveryTerms" defaultValue={d.deliveryTerms} />
          </Field>
          <Field label="Payment terms">
            <Input name="paymentTerms" defaultValue={d.paymentTerms} />
          </Field>
          <Field label="Warranty terms">
            <Input name="warrantyTerms" defaultValue={d.warrantyTerms} />
          </Field>
          <Field label="Footer text">
            <Input name="footerText" defaultValue={d.footerText} />
          </Field>
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm font-bold text-slate-700">
          <input
            name="showGst"
            type="checkbox"
            defaultChecked={d.showGst}
            className="size-4 accent-teal-700"
          />{" "}
          Show GST on documents
        </label>
        {message && (
          <div className="mt-5 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
            {message}
          </div>
        )}
        <button className="mt-6 rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-white">
          Save settings and apply theme
        </button>
      </form>
      <AccessManagement />
    </div>
  );
}

type AccessBranch = {
  _id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
};
type AccessOption = {
  roles: Array<{ key: string; label: string; defaultPermissions: string[] }>;
  permissions: Array<{ key: string; label: string }>;
};
type AccessMembership = {
  _id: string;
  role: string;
  permissions: string[];
  branchIds: AccessBranch[];
  isActive: boolean;
  userId: {
    _id: string;
    name: string;
    email: string;
    isActive: boolean;
    lastLoginAt?: string;
  };
};
type AccessInvitation = {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
};
type AccessActivity = {
  _id: string;
  action: string;
  description: string;
  createdAt: string;
  userId?: { name?: string; email?: string };
};

function AccessManagement() {
  const [branches, setBranches] = useState<AccessBranch[]>([]);
  const [memberships, setMemberships] = useState<AccessMembership[]>([]);
  const [invitations, setInvitations] = useState<AccessInvitation[]>([]);
  const [activity, setActivity] = useState<AccessActivity[]>([]);
  const [options, setOptions] = useState<AccessOption | null>(null);
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  const loadAccess = useCallback(async () => {
    try {
      const [nextBranches, nextMemberships, nextInvitations, nextActivity, nextOptions] =
        await Promise.all([
          apiRequest<AccessBranch[]>("/organization/branches"),
          apiRequest<AccessMembership[]>("/organization/users"),
          apiRequest<AccessInvitation[]>("/organization/invitations"),
          apiRequest<AccessActivity[]>("/organization/activity"),
          apiRequest<AccessOption>("/organization/access/options"),
        ]);
      setBranches(nextBranches);
      setMemberships(nextMemberships);
      setInvitations(nextInvitations);
      setActivity(nextActivity);
      setOptions(nextOptions);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load user access settings",
      );
    }
  }, []);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  async function createBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await apiRequest("/organization/branches", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data)),
      });
      form.reset();
      setMessage("Branch created.");
      await loadAccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create branch");
    }
  }

  async function inviteEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const role = String(data.get("role"));
    const roleOption = options?.roles.find((item) => item.key === role);
    try {
      const result = await apiRequest<{ acceptPath: string }>(
        "/organization/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            name: data.get("name"),
            email: data.get("email"),
            role,
            permissions: roleOption?.defaultPermissions ?? [],
            branchIds: data.getAll("branchIds"),
          }),
        },
      );
      const link = `${window.location.origin}${result.acceptPath}`;
      setInviteLink(link);
      setMessage("Invitation created. Copy and send the secure link.");
      form.reset();
      await loadAccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create invitation");
    }
  }

  async function toggleBranch(branch: AccessBranch) {
    try {
      await apiRequest(`/organization/branches/${branch._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !branch.isActive }),
      });
      setMessage(
        `${branch.name} ${branch.isActive ? "deactivated" : "activated"}.`,
      );
      await loadAccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update branch");
    }
  }

  async function revokeInvitation(invitation: AccessInvitation) {
    try {
      await apiRequest(`/organization/invitations/${invitation._id}/revoke`, {
        method: "PATCH",
      });
      setMessage(`Invitation for ${invitation.email} was revoked.`);
      await loadAccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke invitation");
    }
  }

  async function saveMember(
    membership: AccessMembership,
    form: HTMLFormElement,
  ) {
    const data = new FormData(form);
    const role = String(data.get("role"));
    const selectedPermissions = data.getAll("permissions").map(String);
    try {
      await apiRequest(`/organization/users/${membership._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          permissions:
            role === "owner"
              ? ["*"]
              : selectedPermissions,
          branchIds: data.getAll("branchIds"),
          isActive: data.get("isActive") === "on",
        }),
      });
      setMessage(`Access updated for ${membership.userId.name}.`);
      await loadAccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update access");
    }
  }

  async function resetPassword(membership: AccessMembership) {
    const password = window.prompt(
      `Enter a temporary password for ${membership.userId.name} (minimum 8 characters)`,
    );
    if (!password) return;
    try {
      await apiRequest(`/organization/users/${membership._id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setMessage(`Password reset for ${membership.userId.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset password");
    }
  }

  async function changeOwnPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
        }),
      });
      form.reset();
      setMessage("Your password was changed successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change password");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card md:p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-brand-600" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Access control
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">
              Users, roles and branches
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Assign every employee the minimum access needed for their work.
            </p>
          </div>
        </div>
        {message && (
          <div className="mt-5 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
            {message}
          </div>
        )}
        {inviteLink && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-bold uppercase text-emerald-700">
              Secure invitation link
            </div>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                value={inviteLink}
                className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(inviteLink)}
                className="rounded-lg bg-emerald-700 px-3 text-white"
                aria-label="Copy invitation link"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={createBranch}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-center gap-2">
            <GitBranch size={19} className="text-brand-600" />
            <h3 className="font-black text-ink">Add branch</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input name="code" placeholder="BLR" required />
            <Input name="name" placeholder="Bangalore office" required />
            <Input name="phone" placeholder="Phone" />
            <Input name="address" placeholder="Address" />
          </div>
          <button className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
            Create branch
          </button>
          <div className="mt-4 flex flex-wrap gap-2">
            {branches.map((branch) => (
              <button
                type="button"
                key={branch._id}
                onClick={() => void toggleBranch(branch)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${branch.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              >
                {branch.code} · {branch.name}
              </button>
            ))}
            {!branches.length && (
              <span className="text-sm text-slate-500">No branches created yet.</span>
            )}
          </div>
        </form>

        <form
          onSubmit={inviteEmployee}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-center gap-2">
            <UserPlus size={19} className="text-brand-600" />
            <h3 className="font-black text-ink">Invite employee</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Employee name" required />
            <Input name="email" type="email" placeholder="Email" required />
            <select
              name="role"
              required
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
            >
              {(options?.roles ?? []).filter((role) => role.key !== "owner").map((role) => (
                <option key={role.key} value={role.key}>
                  {role.label}
                </option>
              ))}
            </select>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 text-xs font-bold text-slate-500">Branches</div>
              <div className="space-y-1">
                {branches.filter((branch) => branch.isActive).map((branch) => (
                  <label key={branch._id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="branchIds" value={branch._id} />
                    {branch.name}
                  </label>
                ))}
                {!branches.length && <span className="text-xs text-slate-400">All organization access</span>}
              </div>
            </div>
          </div>
          <button className="mt-4 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white">
            Create invitation
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="font-black text-ink">Team access</h3>
        <p className="mt-1 text-sm text-slate-500">
          Role changes take effect the next time the employee signs in.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {memberships.map((membership) => (
            <form
              key={membership._id}
              onSubmit={(event) => {
                event.preventDefault();
                void saveMember(membership, event.currentTarget);
              }}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <b className="text-ink">{membership.userId.name}</b>
                  <p className="text-xs text-slate-500">{membership.userId.email}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {membership.userId.lastLoginAt
                      ? `Last login ${new Date(membership.userId.lastLoginAt).toLocaleString()}`
                      : "Not signed in yet"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={membership.isActive}
                  />
                  Active
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select
                  name="role"
                  defaultValue={membership.role}
                  disabled={membership.role === "owner"}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  {(options?.roles ?? []).map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <div className="rounded-xl border border-slate-200 p-2">
                  {branches.map((branch) => (
                    <label key={branch._id} className="flex items-center gap-2 py-1 text-xs">
                      <input
                        name="branchIds"
                        type="checkbox"
                        value={branch._id}
                        defaultChecked={membership.branchIds.some(
                          (selected) => selected._id === branch._id,
                        )}
                      />
                      {branch.name}
                    </label>
                  ))}
                  {!branches.length && (
                    <span className="text-xs text-slate-400">All branches</span>
                  )}
                </div>
              </div>
              {membership.role !== "owner" && (
                <details className="mt-3 rounded-xl bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-600">
                    Custom permissions ({membership.permissions.length})
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(options?.permissions ?? []).map((permission) => (
                      <label
                        key={permission.key}
                        className="flex items-start gap-2 text-xs text-slate-600"
                      >
                        <input
                          type="checkbox"
                          name="permissions"
                          value={permission.key}
                          defaultChecked={
                            membership.permissions.includes("*") ||
                            membership.permissions.includes(permission.key)
                          }
                        />
                        {permission.label}
                      </label>
                    ))}
                  </div>
                </details>
              )}
              <div className="mt-3 flex gap-2">
                <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  Save access
                </button>
                <button
                  type="button"
                  onClick={() => void resetPassword(membership)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
                >
                  <KeyRound size={13} /> Reset password
                </button>
              </div>
            </form>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="font-black text-ink">Invitations</h3>
          <div className="mt-4 space-y-2">
            {invitations.slice(0, 10).map((invitation) => (
              <div key={invitation._id} className="flex justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <div>
                  <b className="text-ink">{invitation.name}</b>
                  <span className="block text-xs text-slate-500">{invitation.email} · {invitation.role}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold capitalize text-slate-500">{invitation.status}</span>
                  {invitation.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => void revokeInvitation(invitation)}
                      className="mt-1 block text-xs font-bold text-red-600"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!invitations.length && <p className="text-sm text-slate-500">No invitations yet.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="font-black text-ink">Activity history</h3>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {activity.slice(0, 30).map((entry) => (
              <div key={entry._id} className="border-b border-slate-100 pb-2 text-sm">
                <b className="text-ink">{entry.description}</b>
                <span className="mt-1 block text-xs text-slate-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
            {!activity.length && <p className="text-sm text-slate-500">No access activity yet.</p>}
          </div>
        </div>
      </div>

      <form
        onSubmit={changeOwnPassword}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
      >
        <div className="flex items-center gap-2">
          <KeyRound size={19} className="text-brand-600" />
          <h3 className="font-black text-ink">Change my password</h3>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input name="currentPassword" type="password" placeholder="Current password" required />
          <Input name="newPassword" type="password" placeholder="New password (minimum 8 characters)" minLength={8} required />
        </div>
        <button className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
          Change password
        </button>
      </form>
    </section>
  );
}

function ComparisonWorkspace({
  measurements,
  rateCards,
  quotes,
  onSaved,
}: {
  measurements: Measurement[];
  rateCards: RateCard[];
  quotes: QuotePdfData[];
  onSaved: () => Promise<void>;
}) {
  const [selectedMeasurements, setSelectedMeasurements] = useState<string[]>(
    [],
  );
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [gstPercent, setGstPercent] = useState(18);
  const [options, setOptions] = useState<ComparisonOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const money = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(paise / 100);
  const toggle = (
    list: string[],
    id: string,
    setter: (values: string[]) => void,
  ) =>
    setter(
      list.includes(id) ? list.filter((value) => value !== id) : [...list, id],
    );

  async function compare() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ options: ComparisonOption[] }>(
        "/calculations/compare",
        {
          method: "POST",
          body: JSON.stringify({
            measurementIds: selectedMeasurements,
            rateCardIds: selectedCards,
            gstPercent,
          }),
        },
      );
      setOptions(result.options);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to calculate options",
      );
    } finally {
      setLoading(false);
    }
  }
  async function saveQuote(option: ComparisonOption) {
    const selected = measurements.filter((item) =>
      selectedMeasurements.includes(item._id),
    );
    const projectIds = [
      ...new Set(selected.map((item) => item.projectId?._id).filter(Boolean)),
    ];
    if (projectIds.length !== 1) {
      setError("A quotation must contain measurements from one project.");
      return;
    }
    setSavingId(option.rateCardId);
    setError("");
    try {
      await apiRequest("/quotes", {
        method: "POST",
        body: JSON.stringify({
          projectId: projectIds[0],
          measurementIds: selectedMeasurements,
          rateCardId: option.rateCardId,
          gstPercent,
          validDays: 30,
        }),
      });
      await onSaved();
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to save quotation",
      );
    } finally {
      setSavingId("");
    }
  }
  async function approveQuote(quote: QuotePdfData) {
    if (!quote._id) return;
    const amount = window.prompt(
      "Advance amount received in rupees",
      String(Math.round(quote.pricingSnapshot.totalPaise / 300)),
    );
    if (!amount) return;
    const method =
      window.prompt(
        "Payment method: cash, upi, bank, cheque, card or other",
        "upi",
      ) ?? "upi";
    try {
      await apiRequest(`/operations/quotes/${quote._id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          amountPaise: Math.round(Number(amount) * 100),
          paymentMethod: method,
        }),
      });
      await onSaved();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Approval failed");
    }
  }
  async function createInvoice(quote: QuotePdfData) {
    if (!quote._id) return;
    const taxMode = window.prompt("Tax mode: cgst_sgst or igst", "cgst_sgst");
    if (!taxMode) return;
    const placeOfSupply =
      window.prompt("Place of supply", "Karnataka") ?? "Karnataka";
    const hsnSac = window.prompt("HSN/SAC code", "39252000") ?? "39252000";
    try {
      await apiRequest("/operations/invoices", {
        method: "POST",
        body: JSON.stringify({
          quoteId: quote._id,
          taxMode,
          placeOfSupply,
          hsnSac,
        }),
      });
      window.alert("Draft GST invoice created.");
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Invoice creation failed",
      );
    }
  }
  async function reviseQuote(quote: QuotePdfData) {
    if (!quote._id) return;
    const discount = window.prompt(
      "Discount percentage for the new revision",
      "0",
    );
    if (discount === null) return;
    try {
      await apiRequest(`/quotes/${quote._id}/revise`, {
        method: "POST",
        body: JSON.stringify({
          discountPercent: Number(discount),
          validDays: 30,
        }),
      });
      await onSaved();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Revision failed");
    }
  }
  async function addPayment(quote: QuotePdfData) {
    if (!quote._id) return;
    const amount = window.prompt("Payment received in rupees");
    if (!amount) return;
    const method =
      window.prompt(
        "Payment method: cash, upi, bank, cheque, card or other",
        "upi",
      ) ?? "upi";
    try {
      await apiRequest("/operations/payments", {
        method: "POST",
        body: JSON.stringify({
          quoteId: quote._id,
          amountPaise: Math.round(Number(amount) * 100),
          paymentType: "progress",
          paymentMethod: method,
        }),
      });
      window.alert("Payment receipt recorded.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Payment failed");
    }
  }

  if (!measurements.length || !rateCards.length)
    return (
      <Empty
        icon={FileText}
        title="Measurements and rate cards are required"
        text="Create at least one measurement and one rate card. Then return here to calculate and compare multiple brand options."
      />
    );

  return (
    <div className="mt-7 space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="grid gap-7 lg:grid-cols-2">
          <div>
            <h2 className="font-black text-ink">1. Select measured items</h2>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto">
              {measurements.map((item) => (
                <label
                  key={item._id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedMeasurements.includes(item._id)}
                    onChange={() =>
                      toggle(
                        selectedMeasurements,
                        item._id,
                        setSelectedMeasurements,
                      )
                    }
                    className="size-4 accent-teal-700"
                  />
                  <span className="text-sm">
                    <b>{item.itemNumber}</b> · {item.location}
                    <span className="block text-xs text-slate-500">
                      {item.itemType} · {item.areaSqft.toFixed(2)} sqft ×{" "}
                      {item.quantity}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-black text-ink">
              2. Select brands / rate cards
            </h2>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto">
              {rateCards.map((card) => (
                <label
                  key={card._id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedCards.includes(card._id)}
                    onChange={() =>
                      toggle(selectedCards, card._id, setSelectedCards)
                    }
                    className="size-4 accent-teal-700"
                  />
                  <span className="text-sm">
                    <b>{card.name}</b>
                    <span className="block text-xs text-slate-500">
                      Version {card.version} · {card.customerType} ·{" "}
                      {card.lines.length} rates
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <Field label="GST percentage">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={gstPercent}
              onChange={(event) => setGstPercent(Number(event.target.value))}
            />
          </Field>
          <button
            onClick={() => void compare()}
            disabled={
              loading || !selectedMeasurements.length || !selectedCards.length
            }
            className="flex min-w-56 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-white disabled:opacity-40"
          >
            {loading ? "Calculating…" : "Compare selected brands"}
            <CircleDollarSign size={18} />
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
      </section>
      {options.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Comparison result
              </p>
              <h2 className="mt-1 text-2xl font-black text-ink">
                Choose the best option
              </h2>
            </div>
            <span className="text-sm text-slate-500">
              Lowest price shown first
            </span>
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            {options.map((option, index) => (
              <article
                key={option.rateCardId}
                className={`overflow-hidden rounded-2xl border bg-white shadow-card ${index === 0 ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200"}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {option.customerType} · v{option.version}
                      </div>
                      <h3 className="mt-1 text-xl font-black text-ink">
                        {option.name}
                      </h3>
                    </div>
                    {index === 0 && (
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                        Best price
                      </span>
                    )}
                  </div>
                  <div className="mt-5 space-y-3">
                    {option.lines.map((line) => (
                      <div
                        key={`${line.itemNumber}-${line.productCode}`}
                        className="rounded-xl bg-slate-50 p-3"
                      >
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="font-bold text-ink">
                            {line.location}
                          </span>
                          <span className="font-bold">
                            {money(line.totalPaise)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {line.productName} · {line.billableQuantity}{" "}
                          {line.unit} × {money(line.unitRatePaise)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-slate-100 bg-slate-50 p-5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{money(option.subtotalPaise)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-slate-600">
                    <span>GST {option.gstPercent}%</span>
                    <span>{money(option.taxPaise)}</span>
                  </div>
                  <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-lg font-black text-ink">
                    <span>Total</span>
                    <span>{money(option.totalPaise)}</span>
                  </div>
                  <button
                    onClick={() => void saveQuote(option)}
                    disabled={Boolean(savingId)}
                    className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50"
                  >
                    {savingId === option.rateCardId
                      ? "Saving…"
                      : "Save as quotation"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {quotes.length > 0 && (
        <section>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Saved quotations
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">Documents</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="divide-y divide-slate-100">
              {quotes.map((quote) => (
                <div
                  key={`${quote.quoteNumber}-${quote.revision}`}
                  className="flex flex-col gap-4 p-5"
                >
                  <div>
                    <div className="font-black text-ink">
                      {quote.quoteNumber} · Revision {quote.revision}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {quote.clientId?.name} · {quote.projectId?.name} ·{" "}
                      {money(quote.pricingSnapshot.totalPaise)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                      {quote.status}
                    </span>
                    {quote.status !== "approved" &&
                      quote.status !== "revised" && (
                        <>
                          <button
                            onClick={() => void reviseQuote(quote)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                          >
                            New revision
                          </button>
                          <button
                            onClick={() => void approveQuote(quote)}
                            className="rounded-xl border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700"
                          >
                            Approve & advance
                          </button>
                        </>
                      )}
                    {quote.status === "approved" && (
                      <>
                        <button
                          onClick={() => void addPayment(quote)}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                        >
                          Add payment
                        </button>
                        <button
                          onClick={() => void createInvoice(quote)}
                          className="rounded-xl border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700"
                        >
                          Create invoice
                        </button>
                      </>
                    )}
                    <button
                      onClick={() =>
                        void shareQuoteDocument(quote).catch((problem) =>
                          setError(
                            problem instanceof Error
                              ? problem.message
                              : "Sharing failed",
                          ),
                        )
                      }
                      className="rounded-xl border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700"
                    >
                      Share
                    </button>
                    <button
                      onClick={() => void downloadQuoteDocument(quote)}
                      className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"
                    >
                      Download PDF
                    </button>
                  </div>
                  {quote._id && <RuntimeRecordFields entity="quote" recordId={quote._id} />}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

type OpsKind =
  | "purchasing"
  | "production"
  | "finance"
  | "logistics"
  | "reports"
  | "customize";
function OperationsPanel({
  kind,
  projects,
  products,
}: {
  kind: OpsKind;
  projects: Project[];
  products: CatalogItem[];
}) {
  const [data, setData] = useState<
    Record<string, unknown[] | Record<string, number>>
  >({});
  const [error, setError] = useState("");
  const [reportFrom, setReportFrom] = useState(
    `${new Date().getFullYear()}-01-01`,
  );
  const [reportTo, setReportTo] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const money = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(paise / 100);
  const endpoints: Record<OpsKind, Array<[string, string]>> = {
    purchasing: [
      ["suppliers", "/operations/suppliers"],
      ["purchaseOrders", "/operations/purchase-orders"],
      ["inventory", "/operations/inventory"],
      ["goodsReceipts", "/operations/goods-receipts"],
      ["movements", "/operations/stock-movements"],
    ],
    production: [["boms", "/operations/boms"]],
    finance: [
      ["payments", "/operations/payments"],
      ["invoices", "/operations/invoices"],
      ["creditNotes", "/operations/credit-notes"],
    ],
    logistics: [
      ["deliveries", "/operations/deliveries"],
      ["installations", "/operations/installations"],
      ["certificates", "/operations/completion-certificates"],
    ],
    reports: [
      [
        "overview",
        `/operations/reports/overview?from=${reportFrom}&to=${reportTo}`,
      ],
      [
        "projects",
        `/operations/reports/projects?from=${reportFrom}&to=${reportTo}`,
      ],
      ["gst", `/operations/reports/gst?from=${reportFrom}&to=${reportTo}`],
      ["inventoryReport", "/operations/reports/inventory"],
      [
        "wastage",
        `/operations/reports/wastage?from=${reportFrom}&to=${reportTo}`,
      ],
      [
        "logisticsReport",
        `/operations/reports/logistics?from=${reportFrom}&to=${reportTo}`,
      ],
    ],
    customize: [["definitions", "/operations/custom-definitions"]],
  };
  const loadOps = useCallback(async () => {
    try {
      const values = await Promise.all(
        endpoints[kind].map(
          async ([key, path]) =>
            [
              key,
              await apiRequest<unknown[] | Record<string, number>>(path),
            ] as const,
        ),
      );
      setData(Object.fromEntries(values));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load module");
    }
  }, [kind, reportFrom, reportTo]);
  useEffect(() => {
    void loadOps();
  }, [loadOps]);
  const list = (key: string) =>
    Array.isArray(data[key])
      ? (data[key] as Array<Record<string, unknown>>)
      : [];

  async function quickAdd() {
    try {
      if (kind === "purchasing") {
        const name = window.prompt("Supplier name");
        if (!name) return;
        await apiRequest("/operations/suppliers", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      }
      if (kind === "logistics") {
        const projectId = projects[0]?._id;
        if (!projectId) throw new Error("Create a project first");
        const choice = window.prompt(
          "Type delivery or installation",
          "delivery",
        );
        const scheduledAt = new Date(Date.now() + 86_400_000).toISOString();
        if (choice === "installation")
          await apiRequest("/operations/installations", {
            method: "POST",
            body: JSON.stringify({
              projectId,
              scheduledAt,
              assignedTeam: "Installation Team",
            }),
          });
        else
          await apiRequest("/operations/deliveries", {
            method: "POST",
            body: JSON.stringify({ projectId, scheduledAt }),
          });
      }
      if (kind === "customize") {
        const name = window.prompt("Custom definition name");
        if (!name) return;
        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await apiRequest("/operations/custom-definitions", {
          method: "POST",
          body: JSON.stringify({
            definitionType: "field",
            key,
            name,
            configuration: { fieldType: "text", required: false },
          }),
        });
      }
      if (
        kind === "purchasing" &&
        products.length &&
        list("suppliers").length
      ) {
        /* supplier creation is the safe first purchase step */
      }
      await loadOps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }
  async function advanceBom(record: Record<string, unknown>) {
    const order = [
      "preliminary",
      "released",
      "in_production",
      "quality_check",
      "ready",
      "completed",
    ];
    const next =
      order[
        Math.min(order.indexOf(String(record.status)) + 1, order.length - 1)
      ];
    try {
      await apiRequest(`/operations/boms/${record._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await loadOps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to advance production");
    }
  }
  async function toggleQuality(
    bomId: unknown,
    index: number,
    completed: boolean,
  ) {
    try {
      await apiRequest(`/operations/boms/${bomId}/quality/${index}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      await loadOps();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update quality check",
      );
    }
  }
  async function issueInvoice(id: unknown) {
    try {
      await apiRequest(`/operations/invoices/${id}/issue`, { method: "PATCH" });
      await loadOps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to issue invoice");
    }
  }
  async function invoicePdf(invoice: Record<string, unknown>) {
    try {
      const { downloadInvoicePdf } = await import("./InvoicePdf");
      const [companySettings, template] = await Promise.all([
        apiRequest<NonNullable<InvoicePdfData["companySettings"]>>("/organization/settings"),
        apiRequest<{ configuration: NonNullable<InvoicePdfData["documentTemplate"]> } | null>("/customization/documents/invoice"),
      ]);
      await downloadInvoicePdf({
        ...invoice,
        companySettings,
        documentTemplate: template?.configuration,
      } as unknown as InvoicePdfData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create invoice PDF");
    }
  }
  async function creditInvoice(invoice: Record<string, unknown>) {
    const amount = window.prompt("Credit amount in rupees");
    if (!amount) return;
    const reason = window.prompt("Reason for credit note");
    if (!reason) return;
    try {
      await apiRequest("/operations/credit-notes", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: invoice._id,
          amountPaise: Math.round(Number(amount) * 100),
          reason,
        }),
      });
      await loadOps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create credit note");
    }
  }
  async function createPurchaseOrder() {
    const supplier = list("suppliers")[0];
    const product = products[0];
    if (!supplier || !product) {
      setError("Create a supplier and product first.");
      return;
    }
    const quantity = window.prompt(`Quantity for ${product.name}`, "1");
    const rate = window.prompt("Purchase rate per unit in rupees", "0");
    if (!quantity || rate === null) return;
    try {
      await apiRequest("/operations/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId: supplier._id,
          projectId: projects[0]?._id ?? "",
          items: [
            {
              catalogItemId: product._id,
              quantity: Number(quantity),
              unitRatePaise: Math.round(Number(rate) * 100),
            },
          ],
        }),
      });
      await loadOps();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to create purchase order",
      );
    }
  }
  async function orderPurchaseOrder(id: unknown) {
    try {
      await apiRequest(`/operations/purchase-orders/${id}/order`, {
        method: "PATCH",
      });
      await loadOps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to order");
    }
  }
  async function receivePurchaseOrder(po: Record<string, unknown>) {
    const lines = Array.isArray(po.items)
      ? (po.items as Array<Record<string, unknown>>)
      : [];
    if (!lines.length) return;
    try {
      await apiRequest("/operations/goods-receipts", {
        method: "POST",
        body: JSON.stringify({
          purchaseOrderId: po._id,
          warehouse: "Main",
          items: lines.map((line) => ({
            catalogItemId: line.catalogItemId,
            quantity: Number(line.quantity),
            unit: String(line.unit),
          })),
        }),
      });
      await loadOps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to receive stock");
    }
  }
  async function allocateStock(stock: Record<string, unknown>) {
    const project = projects[0];
    if (!project) {
      setError("Create a project first.");
      return;
    }
    const quantity = window.prompt("Quantity to allocate", "1");
    if (!quantity) return;
    const catalog = stock.catalogItemId as Record<string, unknown> | undefined;
    try {
      await apiRequest("/operations/inventory/allocate", {
        method: "POST",
        body: JSON.stringify({
          catalogItemId: catalog?._id,
          projectId: project._id,
          warehouse: stock.warehouse,
          quantity: Number(quantity),
          unit: catalog?.unit ?? stock.unit ?? "qty",
        }),
      });
      await loadOps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to allocate stock");
    }
  }
  async function advanceDelivery(record: Record<string, unknown>) { const order = ["planned", "packed", "dispatched", "delivered"]; const next = order[Math.min(order.indexOf(String(record.status)) + 1, order.length - 1)]; try { await apiRequest(`/operations/deliveries/${record._id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); await loadOps(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update delivery"); } }
  async function togglePacking(id: unknown, index: number, completed: boolean) { try { await apiRequest(`/operations/deliveries/${id}/checklist/${index}`, { method: "PATCH", body: JSON.stringify({ completed }) }); await loadOps(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update packing"); } }
  async function advanceInstallation(record: Record<string, unknown>) { const order = ["planned", "in_progress", "completed"]; const next = order[Math.min(order.indexOf(String(record.status)) + 1, order.length - 1)]; try { await apiRequest(`/operations/installations/${record._id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); await loadOps(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update installation"); } }
  async function toggleInstallation(id: unknown, index: number, completed: boolean) { try { await apiRequest(`/operations/installations/${id}/checklist/${index}`, { method: "PATCH", body: JSON.stringify({ completed }) }); await loadOps(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update checklist"); } }
  async function addSnag(id: unknown) { const description = window.prompt("Describe the snag or pending work"); if (!description) return; try { await apiRequest(`/operations/installations/${id}/snags`, { method: "POST", body: JSON.stringify({ description }) }); await loadOps(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to add snag"); } }
  async function signOff(id: unknown) { const customerSignatory = window.prompt("Customer signatory name"); if (!customerSignatory) return; const signature = window.prompt("Type customer name again as digital acknowledgement", customerSignatory); if (!signature) return; try { await apiRequest(`/operations/installations/${id}/sign-off`, { method: "POST", body: JSON.stringify({ customerSignatory, signature }) }); await loadOps(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign off"); } }
  if (kind === "customize") return <CustomBuilders />;
  if (kind === "reports") {
    const report = data.overview as Record<string, number> | undefined;
    const gst = data.gst as Record<string, number> | undefined;
    const wastage = data.wastage as Record<string, number> | undefined;
    const logistics = data.logisticsReport as
      | Record<string, number>
      | undefined;
    const projectRows = list("projects");
    const inventoryRows = list("inventoryReport");
    const inventoryValue = inventoryRows.reduce(
      (total, item) => total + Number(item.valuePaise ?? 0),
      0,
    );
    function exportProjectCsv() {
      const headings = [
        "Project number",
        "Project",
        "Status",
        "Revenue",
        "Purchase cost",
        "Gross profit",
        "Margin %",
        "Collected",
        "Outstanding",
      ];
      const rows = projectRows.map((project) => [
        project.projectNumber,
        project.name,
        project.status,
        Number(project.revenuePaise ?? 0) / 100,
        Number(project.purchasePaise ?? 0) / 100,
        Number(project.grossProfitPaise ?? 0) / 100,
        project.grossMarginPercent,
        Number(project.collectedPaise ?? 0) / 100,
        Number(project.outstandingPaise ?? 0) / 100,
      ]);
      const csv = [headings, ...rows]
        .map((row) =>
          row
            .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      link.download = `project-profitability-${reportFrom}-${reportTo}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
    return (
      <div className="mt-7 space-y-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:flex-row lg:items-end lg:justify-between print:hidden">
          <div>
            <h2 className="text-lg font-black text-ink">Reporting period</h2>
            <p className="mt-1 text-sm text-slate-500">
              All sales, cost, GST and performance totals use this date range.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-slate-500">
              From
              <input
                type="date"
                value={reportFrom}
                max={reportTo}
                onChange={(event) => setReportFrom(event.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-xs font-bold text-slate-500">
              To
              <input
                type="date"
                value={reportTo}
                min={reportFrom}
                onChange={(event) => setReportTo(event.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm text-ink"
              />
            </label>
            <button
              onClick={exportProjectCsv}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-ink"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              Print / Save PDF
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total quotations", report?.quotes ?? 0],
            ["Approved orders", report?.approved ?? 0],
            ["Conversion", `${report?.conversionPercent ?? 0}%`],
            ["Approved revenue", money(report?.approvedRevenuePaise ?? 0)],
            ["Payments collected", money(report?.paymentsPaise ?? 0)],
            ["Outstanding", money(report?.outstandingPaise ?? 0)],
            ["Purchase value", money(report?.purchasesPaise ?? 0)],
            ["Low-stock items", report?.lowStock ?? 0],
          ].map(([label, value]) => (
            <article
              key={String(label)}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
            >
              <div className="text-sm font-bold text-slate-500">{label}</div>
              <div className="mt-3 text-2xl font-black text-ink">{value}</div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-ink">
                Project profitability
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Revenue, material purchases, collections and gross margin by
                project.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3">Project</th>
                  <th>Revenue</th>
                  <th>Purchase cost</th>
                  <th>Gross profit</th>
                  <th>Margin</th>
                  <th>Collected</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectRows.map((project) => (
                  <tr key={String(project.projectId)}>
                    <td className="py-3">
                      <b className="text-ink">{String(project.name)}</b>
                      <span className="block text-xs text-slate-500">
                        {String(project.projectNumber)} · {String(project.status)}
                      </span>
                    </td>
                    <td>{money(Number(project.revenuePaise ?? 0))}</td>
                    <td>{money(Number(project.purchasePaise ?? 0))}</td>
                    <td className="font-bold text-ink">
                      {money(Number(project.grossProfitPaise ?? 0))}
                    </td>
                    <td>{String(project.grossMarginPercent ?? 0)}%</td>
                    <td>{money(Number(project.collectedPaise ?? 0))}</td>
                    <td>{money(Number(project.outstandingPaise ?? 0))}</td>
                  </tr>
                ))}
                {!projectRows.length && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No approved project activity in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-lg font-black text-ink">GST summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Invoices", gst?.invoiceCount ?? 0],
                ["Taxable value", money(gst?.taxablePaise ?? 0)],
                ["CGST", money(gst?.cgstPaise ?? 0)],
                ["SGST", money(gst?.sgstPaise ?? 0)],
                ["IGST", money(gst?.igstPaise ?? 0)],
                ["Invoice total", money(gst?.grandTotalPaise ?? 0)],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-lg font-black text-ink">Production usage</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["BOMs generated", wastage?.bomCount ?? 0],
                ["Profile bars", wastage?.profileBars ?? 0],
                ["Required profile", `${((wastage?.requiredProfileMm ?? 0) / 1000).toFixed(1)} m`],
                ["Estimated offcut", `${((wastage?.estimatedOffcutMm ?? 0) / 1000).toFixed(1)} m`],
                ["Average configured waste", `${wastage?.averageWastePercent ?? 0}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-lg font-black text-ink">Delivery & installation</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Deliveries", logistics?.deliveries ?? 0],
                ["Delivered", logistics?.delivered ?? 0],
                ["On-time deliveries", logistics?.onTimeDeliveries ?? 0],
                ["Installations", logistics?.installations ?? 0],
                ["Completed", logistics?.completedInstallations ?? 0],
                ["Open snags", logistics?.openSnags ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-ink">
                Inventory valuation
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Valued with purchase rates from the current active rate card.
              </p>
            </div>
            <div className="text-right">
              <span className="block text-xs font-bold uppercase text-slate-400">
                Total stock value
              </span>
              <b className="text-xl text-ink">{money(inventoryValue)}</b>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3">Item</th>
                  <th>Warehouse</th>
                  <th>On hand</th>
                  <th>Allocated</th>
                  <th>Available</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryRows.map((item) => (
                  <tr key={String(item.stockItemId)}>
                    <td className="py-3">
                      <b className="text-ink">{String(item.name)}</b>
                      <span className="block text-xs text-slate-500">
                        {String(item.code)}
                      </span>
                    </td>
                    <td>{String(item.warehouse)}</td>
                    <td>{String(item.onHand)} {String(item.unit ?? "")}</td>
                    <td>{String(item.allocated)}</td>
                    <td>
                      <span className={item.lowStock ? "font-bold text-red-600" : "font-bold text-emerald-700"}>
                        {String(item.available)}
                      </span>
                    </td>
                    <td>{money(Number(item.valuePaise ?? 0))}</td>
                  </tr>
                ))}
                {!inventoryRows.length && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No stock items available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
  if (kind === "production")
    return (
      <div className="mt-7 space-y-5">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
        {list("boms").length ? (
          list("boms").map((bom) => {
            const items = Array.isArray(bom.items)
              ? (bom.items as Array<Record<string, unknown>>)
              : [];
            const checks = Array.isArray(bom.qualityChecklist)
              ? (bom.qualityChecklist as Array<Record<string, unknown>>)
              : [];
            return (
              <article
                key={String(bom._id)}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-ink">
                      {String(bom.workOrderNumber ?? bom.bomNumber)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {String(bom.bomNumber)} · calculation v
                      {String(bom.calculationVersion ?? 1)} · {items.length}{" "}
                      requirements
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                      {String(bom.status)}
                    </span>
                    {bom.status !== "completed" && (
                      <button
                        onClick={() => void advanceBom(bom)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                      >
                        Next stage
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr>
                        <th className="py-2">Location / component</th>
                        <th>Required</th>
                        <th>Cut size</th>
                        <th>Bars</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, index) => (
                        <tr key={index}>
                          <td className="py-3">
                            <b className="text-ink">
                              {String(item.componentName)}
                            </b>
                            <span className="block text-xs text-slate-500">
                              {String(item.location)}
                            </span>
                          </td>
                          <td>
                            {String(item.requiredQuantity)} {String(item.unit)}
                          </td>
                          <td>
                            {item.cutWidthMm
                              ? `${item.cutWidthMm} × ${item.cutHeightMm} mm`
                              : String(item.notes ?? "—")}
                          </td>
                          <td>{String(item.barCount ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {checks.length > 0 && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-black text-ink">
                      Quality checklist
                    </h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {checks.map((check, index) => (
                        <label
                          key={index}
                          className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(check.completed)}
                            onChange={(event) =>
                              void toggleQuality(
                                bom._id,
                                index,
                                event.target.checked,
                              )
                            }
                            className="size-4 accent-teal-700"
                          />
                          {String(check.label)}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <Empty
            icon={Factory}
            title="No production work orders"
            text="Approving a quotation creates a versioned BOM and work order automatically."
          />
        )}
      </div>
    );
  if (kind === "finance")
    return (
      <div className="mt-7 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-black text-ink">GST invoices</h2>
          {list("invoices").length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {list("invoices").map((invoice) => (
                <div
                  key={String(invoice._id)}
                  className="flex flex-col gap-3 py-4"
                >
                  <div>
                    <b>{String(invoice.invoiceNumber)}</b>
                    <div className="mt-1 text-xs text-slate-500">
                      {String(invoice.taxMode)} · total{" "}
                      {money(Number(invoice.grandTotalPaise ?? 0))} · balance{" "}
                      {money(Number(invoice.balancePaise ?? 0))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">
                      {String(invoice.status)}
                    </span>
                    {invoice.status === "draft" && (
                      <button
                        onClick={() => void issueInvoice(invoice._id)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                      >
                        Issue
                      </button>
                    )}
                    <button
                      onClick={() => void invoicePdf(invoice)}
                      className="rounded-lg border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => void creditInvoice(invoice)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                    >
                      Credit note
                    </button>
                  </div>
                  <RuntimeRecordFields entity="invoice" recordId={String(invoice._id)} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No invoices yet.</p>
          )}
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-black text-ink">Payments and receipts</h2>
            <p className="mt-3 text-3xl font-black">
              {list("payments").length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-black text-ink">Credit notes</h2>
            <p className="mt-3 text-3xl font-black">
              {list("creditNotes").length}
            </p>
          </div>
        </section>
      </div>
    );
  if (kind === "purchasing")
    return (
      <div className="mt-7 space-y-5">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void quickAdd()}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
          >
            Add supplier
          </button>
          <button
            onClick={() => void createPurchaseOrder()}
            className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            Create purchase order
          </button>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="font-black text-ink">Purchase orders</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {list("purchaseOrders").map((po) => (
              <div
                key={String(po._id)}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <b>{String(po.poNumber)}</b>
                  <div className="text-xs text-slate-500">
                    {String(po.status)} · {money(Number(po.totalPaise ?? 0))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {po.status === "draft" && (
                    <button
                      onClick={() => void orderPurchaseOrder(po._id)}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                    >
                      Order
                    </button>
                  )}
                  {(po.status === "ordered" ||
                    po.status === "part_received") && (
                    <button
                      onClick={() => void receivePurchaseOrder(po)}
                      className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      Receive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-ink">Warehouse inventory</h2>
            <span className="text-xs font-bold text-slate-500">
              {list("goodsReceipts").length} receipts ·{" "}
              {list("movements").length} movements
            </span>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {list("inventory").map((stock) => {
              const catalog = stock.catalogItemId as
                Record<string, unknown> | undefined;
              const available =
                Number(stock.onHand ?? 0) - Number(stock.allocated ?? 0);
              return (
                <div
                  key={String(stock._id)}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <b>{String(catalog?.name ?? "Stock item")}</b>
                    <div className="text-xs text-slate-500">
                      {String(stock.warehouse)} · on hand {String(stock.onHand)}{" "}
                      · allocated {String(stock.allocated)} · available{" "}
                      {available}
                    </div>
                  </div>
                  <button
                    onClick={() => void allocateStock(stock)}
                    disabled={available <= 0}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-40"
                  >
                    Allocate
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  if (kind === "logistics") return <div className="mt-7 space-y-5">{error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}<button onClick={() => void quickAdd()} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Schedule delivery / installation</button><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h2 className="font-black text-ink">Deliveries</h2><div className="mt-3 space-y-4">{list("deliveries").map((delivery) => { const checks = Array.isArray(delivery.packingChecklist) ? delivery.packingChecklist as Array<Record<string, unknown>> : []; return <article key={String(delivery._id)} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><b>{String(delivery.deliveryNumber)}</b><div className="text-xs text-slate-500">{String(delivery.status)} · {String(delivery.vehicle ?? "Vehicle not assigned")} · {String(delivery.driver ?? "Driver not assigned")}</div></div>{delivery.status !== "delivered" && <button onClick={() => void advanceDelivery(delivery)} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">Next stage</button>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{checks.map((check, index) => <label key={index} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs"><input type="checkbox" checked={Boolean(check.completed)} onChange={(event) => void togglePacking(delivery._id, index, event.target.checked)} />{String(check.label)}</label>)}</div></article>; })}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h2 className="font-black text-ink">Installations</h2><span className="text-xs font-bold text-slate-500">{list("certificates").length} certificates</span></div><div className="mt-3 space-y-4">{list("installations").map((installation) => { const checks = Array.isArray(installation.checklist) ? installation.checklist as Array<Record<string, unknown>> : []; const snags = Array.isArray(installation.snagItems) ? installation.snagItems as Array<Record<string, unknown>> : []; return <article key={String(installation._id)} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><b>{String(installation.installationNumber)}</b><div className="text-xs text-slate-500">{String(installation.status)} · team {String(installation.assignedTeam)}</div></div><div className="flex flex-wrap gap-2"><button onClick={() => void addSnag(installation._id)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-700">Add snag</button>{!installation.customerSignature && <button onClick={() => void signOff(installation._id)} className="rounded-lg border border-brand-600 px-3 py-2 text-xs font-bold text-brand-700">Customer sign-off</button>}{installation.status !== "completed" && <button onClick={() => void advanceInstallation(installation)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Next stage</button>}</div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{checks.map((check, index) => <label key={index} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs"><input type="checkbox" checked={Boolean(check.completed)} onChange={(event) => void toggleInstallation(installation._id, index, event.target.checked)} />{String(check.label)}</label>)}</div>{snags.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{snags.length} snag item(s) recorded</div>}</article>; })}</div></section></div>;
  return null;
}
