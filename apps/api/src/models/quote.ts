import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const measurementSchema = new Schema(
  { key: String, label: String, value: Number, unit: String },
  { _id: false },
);

const selectedMaterialSchema = new Schema(
  {
    catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem' },
    nameSnapshot: String,
    codeSnapshot: String,
    quantity: Number,
    unit: String,
    unitRatePaise: Number,
    totalPaise: Number,
  },
  { _id: false },
);

const quoteItemSchema = new Schema(
  {
    localId: { type: String, required: true },
    areaLocalId: String,
    categoryKey: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    measurements: [measurementSchema],
    attributes: { type: Map, of: Schema.Types.Mixed },
    selectedMaterials: [selectedMaterialSchema],
    lineTotalPaise: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const quoteOptionSchema = new Schema(
  {
    name: { type: String, required: true },
    kind: { type: String, enum: ['economy', 'standard', 'premium', 'custom'], required: true },
    brandSelections: { type: Map, of: Schema.Types.ObjectId },
    subtotalPaise: Number,
    taxPaise: Number,
    totalPaise: Number,
  },
  { _id: true },
);

const quoteSchema = new Schema(
  {
    ...tenantFields,
    quoteNumber: { type: String, required: true },
    revision: { type: Number, default: 0 },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    status: { type: String, default: 'draft' },
    validUntil: Date,
    items: [quoteItemSchema],
    options: [quoteOptionSchema],
    selectedOptionId: Schema.Types.ObjectId,
    pricingSnapshot: Schema.Types.Mixed,
    lockedAt: Date,
    approvedAt: Date,
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);
quoteSchema.index({ organizationId: 1, quoteNumber: 1, revision: 1 }, { unique: true });
export const Quote = model('Quote', quoteSchema);
