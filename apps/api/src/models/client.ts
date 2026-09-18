import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const clientSchema = new Schema(
  {
    ...tenantFields,
    clientCode: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: String,
    email: { type: String, trim: true, lowercase: true },
    billingAddress: String,
    siteAddress: String,
    gstin: String,
    notes: String,
    isActive: { type: Boolean, default: true },
    customValues: { type: Map, of: Schema.Types.Mixed },
    calculatedValues: { type: Map, of: Number },
  },
  { timestamps: true },
);

clientSchema.index({ organizationId: 1, clientCode: 1 }, { unique: true });
clientSchema.index({ organizationId: 1, phone: 1 });
export const Client = model('Client', clientSchema);
