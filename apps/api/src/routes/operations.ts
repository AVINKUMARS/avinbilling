import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { Quote } from '../models/quote.js';
import { Client } from '../models/client.js';
import { Project } from '../models/project.js';
import { CatalogItem } from '../models/catalog.js';
import { Bom, CustomDefinition, Delivery, Installation, Invoice, Payment, PurchaseOrder, StockItem, Supplier } from '../models/operations.js';

export const operationsRouter = Router();
operationsRouter.use(requireAuth);
const objectId = z.string().regex(/^[a-f\d]{24}$/i);

operationsRouter.post('/quotes/:id/approve', requirePermission('quotes.approve'), async (request, response, next) => {
  const inputSchema = z.object({ amountPaise: z.number().int().positive(), paymentMethod: z.enum(['cash', 'upi', 'bank', 'cheque', 'card', 'other']), transactionReference: z.string().max(120).optional() });
  const session = await mongoose.startSession();
  try {
    const input = inputSchema.parse(request.body); const organizationId = request.auth!.organizationId; let result: unknown;
    await session.withTransaction(async () => {
      const quote = await Quote.findOne({ _id: request.params.id, organizationId }).session(session);
      if (!quote) throw new Error('Quotation not found');
      if (quote.status === 'approved' || quote.lockedAt) throw new Error('Quotation is already approved and locked');
      const totalPaise = Number((quote.pricingSnapshot as { totalPaise?: number } | undefined)?.totalPaise ?? 0);
      if (input.amountPaise > totalPaise) throw new Error('Advance cannot exceed quotation total');
      const paymentCount = await Payment.countDocuments({ organizationId }).session(session);
      const [payment] = await Payment.create([{ organizationId, quoteId: quote._id, receiptNumber: `REC-${String(paymentCount + 1).padStart(5, '0')}`, amountPaise: input.amountPaise, paymentType: 'advance', paymentMethod: input.paymentMethod, transactionReference: input.transactionReference, createdBy: request.auth!.userId, updatedBy: request.auth!.userId }], { session });
      const bomCount = await Bom.countDocuments({ organizationId }).session(session);
      const bomItems = quote.items.flatMap((item) => item.selectedMaterials.map((material) => ({ quoteItemLocalId: item.localId, location: item.name, componentName: material.nameSnapshot, componentCode: material.codeSnapshot, quantity: item.quantity, unit: material.unit, requiredQuantity: material.quantity, notes: 'Preliminary BOM from quotation snapshot; verify factory cutting rules before release.' })));
      const [bom] = await Bom.create([{ organizationId, bomNumber: `BOM-${String(bomCount + 1).padStart(5, '0')}`, quoteId: quote._id, quoteRevision: quote.revision, items: bomItems, createdBy: request.auth!.userId, updatedBy: request.auth!.userId }], { session });
      quote.status = 'approved'; quote.approvedAt = new Date(); quote.lockedAt = new Date(); quote.updatedBy = request.auth!.userId; await quote.save({ session });
      result = { quote, payment, bom };
    });
    response.json({ data: result });
  } catch (error) { next(error); } finally { await session.endSession(); }
});

operationsRouter.get('/payments', async (request, response, next) => { try { response.json({ data: await Payment.find({ organizationId: request.auth!.organizationId }).populate('quoteId', 'quoteNumber').sort({ receivedAt: -1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.post('/payments', requirePermission('quotes.approve'), async (request, response, next) => {
  try {
    const input = z.object({ quoteId: objectId, amountPaise: z.number().int().positive(), paymentType: z.enum(['advance', 'progress', 'final', 'refund']).default('progress'), paymentMethod: z.enum(['cash', 'upi', 'bank', 'cheque', 'card', 'other']), transactionReference: z.string().max(120).optional(), notes: z.string().max(500).optional() }).parse(request.body);
    const organizationId = request.auth!.organizationId; const quote = await Quote.findOne({ _id: input.quoteId, organizationId, status: 'approved' }).lean();
    if (!quote) { response.status(400).json({ error: { code: 'QUOTE_NOT_APPROVED', message: 'Approved quotation required' } }); return; }
    const total = Number((quote.pricingSnapshot as { totalPaise?: number }).totalPaise ?? 0); const existing = await Payment.find({ quoteId: quote._id, organizationId, status: 'recorded' }).lean(); const paid = existing.reduce((sum, payment) => sum + (payment.paymentType === 'refund' ? -payment.amountPaise : payment.amountPaise), 0);
    if (input.paymentType !== 'refund' && paid + input.amountPaise > total) { response.status(400).json({ error: { code: 'OVERPAYMENT', message: 'Payment exceeds outstanding balance' } }); return; }
    const count = await Payment.countDocuments({ organizationId }); const data = await Payment.create({ ...input, organizationId, receiptNumber: `REC-${String(count + 1).padStart(5, '0')}`, createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    const nextPaid = paid + (input.paymentType === 'refund' ? -input.amountPaise : input.amountPaise); await Invoice.updateMany({ quoteId: quote._id, organizationId }, { $set: { paidPaise: nextPaid, balancePaise: total - nextPaid, status: nextPaid >= total ? 'paid' : 'part_paid', updatedBy: request.auth!.userId } });
    response.status(201).json({ data });
  } catch (e) { next(e); }
});
operationsRouter.get('/boms', async (request, response, next) => { try { response.json({ data: await Bom.find({ organizationId: request.auth!.organizationId }).populate('quoteId', 'quoteNumber').sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.patch('/boms/:id/status', requirePermission('production.update'), async (request, response, next) => { try { const status = z.enum(['preliminary', 'released', 'in_production', 'quality_check', 'ready', 'completed']).parse(request.body.status); const data = await Bom.findOneAndUpdate({ _id: request.params.id, organizationId: request.auth!.organizationId }, { status, updatedBy: request.auth!.userId }, { new: true }); response.json({ data }); } catch (e) { next(e); } });

operationsRouter.get('/invoices', async (request, response, next) => { try { response.json({ data: await Invoice.find({ organizationId: request.auth!.organizationId }).populate('quoteId', 'quoteNumber').sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.post('/invoices', requirePermission('invoices.create'), async (request, response, next) => {
  try {
    const quoteId = objectId.parse(request.body.quoteId); const organizationId = request.auth!.organizationId;
    const quote = await Quote.findOne({ _id: quoteId, organizationId, status: 'approved' }).lean(); if (!quote) { response.status(400).json({ error: { code: 'QUOTE_NOT_APPROVED', message: 'An approved quotation is required' } }); return; }
    const client = await Client.findOne({ _id: quote.clientId, organizationId }).lean(); const payments = await Payment.find({ quoteId, organizationId, status: 'recorded' }).lean();
    const snapshot = quote.pricingSnapshot as { subtotalPaise: number; taxPaise: number; totalPaise: number }; const paidPaise = payments.reduce((sum, p) => sum + p.amountPaise, 0); const invoiceCount = await Invoice.countDocuments({ organizationId });
    const taxHalf = Math.round(snapshot.taxPaise / 2);
    const data = await Invoice.create({ organizationId, invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`, quoteId, clientSnapshot: client, lineItems: quote.items, subtotalPaise: snapshot.subtotalPaise, cgstPaise: taxHalf, sgstPaise: snapshot.taxPaise - taxHalf, igstPaise: 0, grandTotalPaise: snapshot.totalPaise, paidPaise, balancePaise: snapshot.totalPaise - paidPaise, status: 'draft', dueAt: new Date(Date.now() + 15 * 86_400_000), createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (e) { next(e); }
});

operationsRouter.get('/suppliers', async (request, response, next) => { try { response.json({ data: await Supplier.find({ organizationId: request.auth!.organizationId, isActive: true }).sort({ name: 1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.post('/suppliers', requirePermission('purchasing.create'), async (request, response, next) => { try { const input = z.object({ name: z.string().min(2), phone: z.string().optional(), email: z.string().email().optional().or(z.literal('')), gstin: z.string().optional(), address: z.string().optional() }).parse(request.body); const count = await Supplier.countDocuments({ organizationId: request.auth!.organizationId }); const data = await Supplier.create({ ...input, supplierCode: `SUP-${String(count + 1).padStart(4, '0')}`, organizationId: request.auth!.organizationId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId }); response.status(201).json({ data }); } catch (e) { next(e); } });
operationsRouter.get('/purchase-orders', async (request, response, next) => { try { response.json({ data: await PurchaseOrder.find({ organizationId: request.auth!.organizationId }).populate('supplierId', 'name').populate('projectId', 'name').sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.post('/purchase-orders', requirePermission('purchasing.create'), async (request, response, next) => { try { const input = z.object({ supplierId: objectId, projectId: objectId.optional(), catalogItemId: objectId, quantity: z.number().positive(), unitRatePaise: z.number().int().min(0) }).parse(request.body); const item = await CatalogItem.findOne({ _id: input.catalogItemId, organizationId: request.auth!.organizationId }).lean(); if (!item) throw new Error('Catalog item not found'); const count = await PurchaseOrder.countDocuments({ organizationId: request.auth!.organizationId }); const totalPaise = Math.round(input.quantity * input.unitRatePaise); const data = await PurchaseOrder.create({ organizationId: request.auth!.organizationId, poNumber: `PO-${String(count + 1).padStart(5, '0')}`, supplierId: input.supplierId, projectId: input.projectId, items: [{ catalogItemId: item._id, nameSnapshot: item.name, quantity: input.quantity, unit: item.unit, unitRatePaise: input.unitRatePaise, totalPaise }], totalPaise, createdBy: request.auth!.userId, updatedBy: request.auth!.userId }); response.status(201).json({ data }); } catch (e) { next(e); } });
operationsRouter.get('/inventory', async (request, response, next) => { try { response.json({ data: await StockItem.find({ organizationId: request.auth!.organizationId }).populate('catalogItemId', 'name code unit').sort({ warehouse: 1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.post('/inventory/adjust', requirePermission('inventory.adjust'), async (request, response, next) => { try { const input = z.object({ catalogItemId: objectId, warehouse: z.string().default('Main'), change: z.number(), reorderLevel: z.number().min(0).default(0) }).parse(request.body); const data = await StockItem.findOneAndUpdate({ organizationId: request.auth!.organizationId, catalogItemId: input.catalogItemId, warehouse: input.warehouse }, { $inc: { onHand: input.change }, $set: { reorderLevel: input.reorderLevel, updatedBy: request.auth!.userId }, $setOnInsert: { createdBy: request.auth!.userId } }, { upsert: true, new: true }); response.json({ data }); } catch (e) { next(e); } });

operationsRouter.get('/deliveries', async (request, response, next) => { try { response.json({ data: await Delivery.find({ organizationId: request.auth!.organizationId }).populate('projectId', 'name projectNumber').sort({ scheduledAt: 1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.post('/deliveries', requirePermission('delivery.create'), async (request, response, next) => { try { const input = z.object({ projectId: objectId, scheduledAt: z.coerce.date(), vehicle: z.string().optional(), driver: z.string().optional(), notes: z.string().optional() }).parse(request.body); const count = await Delivery.countDocuments({ organizationId: request.auth!.organizationId }); const data = await Delivery.create({ ...input, deliveryNumber: `DEL-${String(count + 1).padStart(5, '0')}`, organizationId: request.auth!.organizationId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId }); response.status(201).json({ data }); } catch (e) { next(e); } });
operationsRouter.get('/installations', async (request, response, next) => { try { response.json({ data: await Installation.find({ organizationId: request.auth!.organizationId }).populate('projectId', 'name projectNumber').sort({ scheduledAt: 1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.post('/installations', requirePermission('installation.create'), async (request, response, next) => { try { const input = z.object({ projectId: objectId, scheduledAt: z.coerce.date(), assignedTeam: z.string().min(1), notes: z.string().optional() }).parse(request.body); const count = await Installation.countDocuments({ organizationId: request.auth!.organizationId }); const data = await Installation.create({ ...input, installationNumber: `INS-${String(count + 1).padStart(5, '0')}`, checklist: [{ label: 'Site ready', completed: false }, { label: 'Items verified', completed: false }, { label: 'Customer sign-off', completed: false }], organizationId: request.auth!.organizationId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId }); response.status(201).json({ data }); } catch (e) { next(e); } });

operationsRouter.get('/reports/overview', async (request, response, next) => { try { const organizationId = request.auth!.organizationId; const [quotes, approved, revenue, paid, purchase, lowStock] = await Promise.all([Quote.countDocuments({ organizationId }), Quote.countDocuments({ organizationId, status: 'approved' }), Quote.aggregate([{ $match: { organizationId, status: 'approved' } }, { $group: { _id: null, total: { $sum: '$pricingSnapshot.totalPaise' } } }]), Payment.aggregate([{ $match: { organizationId, status: 'recorded' } }, { $group: { _id: null, total: { $sum: '$amountPaise' } } }]), PurchaseOrder.aggregate([{ $match: { organizationId } }, { $group: { _id: null, total: { $sum: '$totalPaise' } } }]), StockItem.countDocuments({ organizationId, $expr: { $lte: ['$onHand', '$reorderLevel'] } })]); response.json({ data: { quotes, approved, approvedRevenuePaise: revenue[0]?.total ?? 0, paymentsPaise: paid[0]?.total ?? 0, purchasesPaise: purchase[0]?.total ?? 0, lowStock } }); } catch (e) { next(e); } });
operationsRouter.get('/custom-definitions', async (request, response, next) => { try { response.json({ data: await CustomDefinition.find({ organizationId: request.auth!.organizationId }).sort({ definitionType: 1, name: 1 }).lean() }); } catch (e) { next(e); } });
operationsRouter.post('/custom-definitions', requirePermission('settings.customize'), async (request, response, next) => { try { const input = z.object({ definitionType: z.enum(['field', 'form', 'workflow', 'formula', 'document']), key: z.string().min(2), name: z.string().min(2), configuration: z.unknown() }).parse(request.body); const previous = await CustomDefinition.findOne({ organizationId: request.auth!.organizationId, definitionType: input.definitionType, key: input.key }).sort({ version: -1 }).lean(); const data = await CustomDefinition.create({ ...input, version: (previous?.version ?? 0) + 1, organizationId: request.auth!.organizationId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId }); response.status(201).json({ data }); } catch (e) { next(e); } });
