import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const warrantySchema = new Schema(
  {
    ...tenantFields,
    warrantyNumber: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    installationId: { type: Schema.Types.ObjectId, ref: 'Installation' },
    catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem' },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    terms: String,
    status: { type: String, enum: ['active', 'expired', 'void'], default: 'active' },
    notes: String,
  },
  { timestamps: true }
);

warrantySchema.index({ organizationId: 1, warrantyNumber: 1 }, { unique: true });
export const Warranty = model('Warranty', warrantySchema);

const serviceTicketSchema = new Schema(
  {
    ...tenantFields,
    ticketNumber: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    warrantyId: { type: Schema.Types.ObjectId, ref: 'Warranty' },
    description: { type: String, required: true },
    status: { type: String, enum: ['open', 'scheduled', 'in_progress', 'resolved', 'closed'], default: 'open' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduledAt: Date,
    partsUsed: [
      {
        catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem' },
        quantity: Number,
      }
    ],
    serviceChargePaise: { type: Number, default: 0 },
    customerSignatory: String,
    customerSignature: String,
    resolvedAt: Date,
    notes: String,
  },
  { timestamps: true }
);

serviceTicketSchema.index({ organizationId: 1, ticketNumber: 1 }, { unique: true });
export const ServiceTicket = model('ServiceTicket', serviceTicketSchema);
