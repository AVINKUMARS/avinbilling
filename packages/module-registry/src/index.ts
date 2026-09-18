import type { ModuleKey } from '@avin/shared';

export type BusinessModule = {
  key: ModuleKey;
  name: string;
  description: string;
  dependencies: ModuleKey[];
  phase: 'foundation' | 'operations' | 'advanced';
};

export const moduleCatalog: BusinessModule[] = [
  { key: 'crm', name: 'CRM', description: 'Leads and customer relationships', dependencies: [], phase: 'foundation' },
  { key: 'projects', name: 'Projects', description: 'Buildings, areas, packages and tasks', dependencies: ['crm'], phase: 'foundation' },
  { key: 'catalog', name: 'Catalog', description: 'Products, brands, materials and rates', dependencies: [], phase: 'foundation' },
  { key: 'measurements', name: 'Measurements', description: 'Configurable surveys and measurements', dependencies: ['projects'], phase: 'foundation' },
  { key: 'quotations', name: 'Quotations', description: 'Comparisons, proposals and approvals', dependencies: ['crm', 'catalog'], phase: 'foundation' },
  { key: 'purchasing', name: 'Purchasing', description: 'Suppliers, requests and purchase orders', dependencies: ['catalog'], phase: 'operations' },
  { key: 'inventory', name: 'Inventory', description: 'Stock, allocations, returns and wastage', dependencies: ['catalog', 'purchasing'], phase: 'operations' },
  { key: 'production', name: 'Production', description: 'BOMs, work orders and quality control', dependencies: ['catalog', 'projects'], phase: 'operations' },
  { key: 'delivery', name: 'Delivery', description: 'Packing, dispatch and delivery notes', dependencies: ['projects'], phase: 'operations' },
  { key: 'installation', name: 'Installation', description: 'Teams, schedules and completion checks', dependencies: ['projects'], phase: 'operations' },
  { key: 'finance', name: 'Finance', description: 'Invoices, payments, expenses and GST', dependencies: ['crm'], phase: 'foundation' },
  { key: 'service', name: 'Service', description: 'Warranty, complaints and service work', dependencies: ['crm'], phase: 'advanced' },
  { key: 'reports', name: 'Reports', description: 'Operational and financial insights', dependencies: [], phase: 'foundation' },
];

export function resolveModules(requested: ModuleKey[]): ModuleKey[] {
  const resolved = new Set<ModuleKey>();
  const byKey = new Map(moduleCatalog.map((module) => [module.key, module]));

  function add(key: ModuleKey) {
    if (resolved.has(key)) return;
    const module = byKey.get(key);
    if (!module) throw new Error(`Unknown module: ${key}`);
    module.dependencies.forEach(add);
    resolved.add(key);
  }

  requested.forEach(add);
  return [...resolved];
}
