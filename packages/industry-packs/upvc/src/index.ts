import type { ModuleKey } from '@meera/shared';

export type IndustryPack = {
  key: string;
  name: string;
  version: number;
  requiredModules: ModuleKey[];
  categories: string[];
  defaultWorkflow: string[];
  measurementFields: Array<{ key: string; label: string; unit: string; required: boolean }>;
};

export const upvcPack: IndustryPack = {
  key: 'upvc',
  name: 'UPVC Windows and Doors',
  version: 1,
  requiredModules: ['catalog', 'projects', 'measurements', 'quotations', 'production', 'installation'],
  categories: ['sliding-window', 'casement-window', 'fixed-window', 'sliding-door', 'ventilator'],
  defaultWorkflow: ['approved', 'material-check', 'cutting', 'reinforcement', 'welding', 'assembly', 'glazing', 'quality-check', 'ready', 'dispatched', 'installed'],
  measurementFields: [
    { key: 'widthMm', label: 'Width', unit: 'mm', required: true },
    { key: 'heightMm', label: 'Height', unit: 'mm', required: true },
    { key: 'quantity', label: 'Quantity', unit: 'qty', required: true },
  ],
};
