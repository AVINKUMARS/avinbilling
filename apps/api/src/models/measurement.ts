import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const measurementItemSchema = new Schema(
  {
    ...tenantFields,
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    areaLocalId: String,
    itemNumber: { type: String, required: true },
    location: { type: String, required: true },
    categoryKey: { type: String, required: true },
    itemType: { type: String, required: true },
    widthMm: { type: Number, required: true, min: 1 },
    heightMm: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    areaSqft: { type: Number, required: true, min: 0 },
    notes: String,
    attributes: { type: Map, of: Schema.Types.Mixed },
    status: { type: String, enum: ['draft', 'verified', 'locked'], default: 'draft' },
    measuredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

measurementItemSchema.index({ organizationId: 1, projectId: 1, itemNumber: 1 }, { unique: true });
export const MeasurementItem = model('MeasurementItem', measurementItemSchema);
