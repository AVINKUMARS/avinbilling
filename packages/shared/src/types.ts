export const MODULE_KEYS = [
  'crm',
  'projects',
  'catalog',
  'measurements',
  'quotations',
  'purchasing',
  'inventory',
  'production',
  'delivery',
  'installation',
  'finance',
  'service',
  'reports',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type QuoteStatus =
  | 'draft'
  | 'internal_review'
  | 'sent'
  | 'viewed'
  | 'negotiation'
  | 'accepted'
  | 'advance_pending'
  | 'approved'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type MeasurementValue = {
  key: string;
  label: string;
  value: number;
  unit: 'mm' | 'sqft' | 'rft' | 'qty' | 'hour' | 'kg';
};

export type PricingSnapshot = {
  currency: 'INR';
  rateCardId: string;
  rateCardVersion: number;
  materialPaise: number;
  labourPaise: number;
  wastagePaise: number;
  discountPaise: number;
  taxablePaise: number;
  taxPaise: number;
  totalPaise: number;
};
