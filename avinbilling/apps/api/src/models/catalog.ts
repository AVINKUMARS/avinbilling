import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const brandSchema = new Schema(
  {
    ...tenantFields,
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    companyName: String,
    warrantyText: String,
    colors: [String],
    categories: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
brandSchema.index({ organizationId: 1, code: 1 }, { unique: true });
export const Brand = model('Brand', brandSchema);

const catalogItemSchema = new Schema(
  {
    ...tenantFields,
    categoryKey: { type: String, required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand' },
    seriesId: { type: Schema.Types.ObjectId, ref: 'ProductSeries' },
    name: { type: String, required: true },
    code: { type: String, required: true },
    itemType: { type: String, enum: ['product', 'material', 'component', 'hardware', 'service'], required: true },
    unit: { type: String, required: true },
    attributes: { type: Map, of: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
catalogItemSchema.index({ organizationId: 1, code: 1 }, { unique: true });
export const CatalogItem = model('CatalogItem', catalogItemSchema);

const rateLineSchema = new Schema(
  {
    catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true },
    purchaseRatePaise: { type: Number, required: true, min: 0 },
    sellingRatePaise: { type: Number, required: true, min: 0 },
    minimumSellingRatePaise: { type: Number, min: 0 },
    wastagePercent: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false },
);

const rateCardSchema = new Schema(
  {
    ...tenantFields,
    name: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
    customerType: { type: String, enum: ['retail', 'dealer', 'builder', 'project', 'custom'], default: 'retail' },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: Date,
    defaultWastagePercent: { type: Number, min: 0, max: 100, default: 0 },
    lines: [rateLineSchema],
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
  },
  { timestamps: true },
);
rateCardSchema.index({ organizationId: 1, name: 1, version: 1 }, { unique: true });
export const RateCard = model('RateCard', rateCardSchema);
