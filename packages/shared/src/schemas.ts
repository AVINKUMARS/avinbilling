import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const organizationBootstrapSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  adminName: z.string().trim().min(2).max(100),
  adminEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
  enabledModules: z.array(z.string()).default([
    'crm',
    'projects',
    'catalog',
    'measurements',
    'quotations',
    'finance',
    'reports',
  ]),
  industryPacks: z.array(z.string()).default(['upvc']),
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  organizationId: objectIdSchema.optional(),
});

export const clientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(20),
  alternatePhone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional(),
  billingAddress: z.string().trim().max(500).optional(),
  siteAddress: z.string().trim().max(500).optional(),
  gstin: z.string().trim().max(15).optional(),
});
