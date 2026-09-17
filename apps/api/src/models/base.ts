import type { SchemaDefinition } from 'mongoose';

export const tenantFields = {
  organizationId: { type: 'ObjectId', ref: 'Organization', required: true, index: true },
  branchId: { type: 'ObjectId', ref: 'Branch', index: true },
  createdBy: { type: 'ObjectId', ref: 'User' },
  updatedBy: { type: 'ObjectId', ref: 'User' },
} satisfies SchemaDefinition;
