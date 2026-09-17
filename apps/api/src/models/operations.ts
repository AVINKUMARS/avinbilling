import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const paymentSchema = new Schema({
  ...tenantFields, quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true, index: true }, invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  receiptNumber: { type: String, required: true }, amountPaise: { type: Number, required: true, min: 1 }, paymentType: { type: String, enum: ['advance', 'progress', 'final', 'refund'], required: true },
  paymentMethod: { type: String, enum: ['cash', 'upi', 'bank', 'cheque', 'card', 'other'], required: true }, transactionReference: String, receivedAt: { type: Date, default: Date.now }, status: { type: String, enum: ['recorded', 'reversed'], default: 'recorded' }, notes: String,
}, { timestamps: true });
paymentSchema.index({ organizationId: 1, receiptNumber: 1 }, { unique: true });
export const Payment = model('Payment', paymentSchema);

const bomSchema = new Schema({
  ...tenantFields, bomNumber: { type: String, required: true }, quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true, index: true }, quoteRevision: Number,
  status: { type: String, enum: ['preliminary', 'released', 'in_production', 'quality_check', 'ready', 'completed'], default: 'preliminary' },
  workOrderNumber: String,
  calculationVersion: { type: Number, default: 2 },
  items: [{ quoteItemLocalId: String, location: String, componentName: String, componentCode: String, quantity: Number, unit: String, requiredQuantity: Number, cutLengthMm: Number, cutWidthMm: Number, cutHeightMm: Number, barCount: Number, wastagePercent: Number, notes: String }],
  workflow: [{ stage: String, completed: { type: Boolean, default: false }, completedAt: Date }],
  qualityChecklist: [{ label: String, completed: { type: Boolean, default: false }, notes: String }],
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });
bomSchema.index({ organizationId: 1, bomNumber: 1 }, { unique: true });
export const Bom = model('Bom', bomSchema);

const invoiceSchema = new Schema({
  ...tenantFields, invoiceNumber: { type: String, required: true }, quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true, index: true }, clientSnapshot: Schema.Types.Mixed,
  lineItems: [Schema.Types.Mixed], taxMode: { type: String, enum: ['cgst_sgst', 'igst'], default: 'cgst_sgst' }, gstPercent: { type: Number, default: 18 }, placeOfSupply: String, subtotalPaise: Number, discountPaise: Number, taxablePaise: Number, cgstPaise: Number, sgstPaise: Number, igstPaise: Number, grandTotalPaise: Number, paidPaise: Number, creditedPaise: { type: Number, default: 0 }, balancePaise: Number,
  status: { type: String, enum: ['draft', 'issued', 'part_paid', 'paid', 'cancelled'], default: 'draft' }, issuedAt: Date, dueAt: Date,
}, { timestamps: true });
invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
export const Invoice = model('Invoice', invoiceSchema);

const creditNoteSchema = new Schema({ ...tenantFields, creditNoteNumber: { type: String, required: true }, invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true }, quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true }, reason: { type: String, required: true }, amountPaise: { type: Number, required: true, min: 1 }, status: { type: String, enum: ['issued', 'cancelled'], default: 'issued' }, issuedAt: { type: Date, default: Date.now } }, { timestamps: true });
creditNoteSchema.index({ organizationId: 1, creditNoteNumber: 1 }, { unique: true });
export const CreditNote = model('CreditNote', creditNoteSchema);

const supplierSchema = new Schema({ ...tenantFields, supplierCode: String, name: { type: String, required: true }, phone: String, email: String, gstin: String, address: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
supplierSchema.index({ organizationId: 1, supplierCode: 1 }, { unique: true });
export const Supplier = model('Supplier', supplierSchema);

const purchaseOrderSchema = new Schema({ ...tenantFields, poNumber: String, supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true }, projectId: { type: Schema.Types.ObjectId, ref: 'Project' }, items: [{ catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem' }, nameSnapshot: String, quantity: Number, unit: String, unitRatePaise: Number, totalPaise: Number }], totalPaise: Number, status: { type: String, enum: ['draft', 'ordered', 'part_received', 'received', 'cancelled'], default: 'draft' }, expectedAt: Date }, { timestamps: true });
purchaseOrderSchema.index({ organizationId: 1, poNumber: 1 }, { unique: true });
export const PurchaseOrder = model('PurchaseOrder', purchaseOrderSchema);

const stockItemSchema = new Schema({ ...tenantFields, catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true }, warehouse: { type: String, default: 'Main' }, onHand: { type: Number, default: 0 }, allocated: { type: Number, default: 0 }, unit: String, reorderLevel: { type: Number, default: 0 } }, { timestamps: true });
stockItemSchema.index({ organizationId: 1, catalogItemId: 1, warehouse: 1 }, { unique: true });
export const StockItem = model('StockItem', stockItemSchema);

const deliverySchema = new Schema({ ...tenantFields, deliveryNumber: String, projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true }, quoteId: { type: Schema.Types.ObjectId, ref: 'Quote' }, scheduledAt: Date, vehicle: String, driver: String, status: { type: String, enum: ['planned', 'packed', 'dispatched', 'delivered'], default: 'planned' }, notes: String }, { timestamps: true });
deliverySchema.index({ organizationId: 1, deliveryNumber: 1 }, { unique: true });
export const Delivery = model('Delivery', deliverySchema);

const installationSchema = new Schema({ ...tenantFields, installationNumber: String, projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true }, scheduledAt: Date, assignedTeam: String, status: { type: String, enum: ['planned', 'in_progress', 'snag', 'completed'], default: 'planned' }, checklist: [{ label: String, completed: Boolean }], notes: String, completedAt: Date }, { timestamps: true });
installationSchema.index({ organizationId: 1, installationNumber: 1 }, { unique: true });
export const Installation = model('Installation', installationSchema);

const customDefinitionSchema = new Schema({ ...tenantFields, definitionType: { type: String, enum: ['field', 'form', 'workflow', 'formula', 'document'], required: true }, key: { type: String, required: true }, name: { type: String, required: true }, version: { type: Number, default: 1 }, status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' }, configuration: Schema.Types.Mixed }, { timestamps: true });
customDefinitionSchema.index({ organizationId: 1, definitionType: 1, key: 1, version: 1 }, { unique: true });
export const CustomDefinition = model('CustomDefinition', customDefinitionSchema);
