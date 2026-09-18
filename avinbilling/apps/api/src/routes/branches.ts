import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requirePermission, tenantFilter } from '../middleware/auth.js';
import { ApiError } from '../middleware/error-handler.js';
import { Branch, BranchTransfer, Warehouse } from '../models/access.js';
import { Client } from '../models/client.js';
import { Project } from '../models/project.js';
import { MeasurementItem } from '../models/measurement.js';
import { Quote } from '../models/quote.js';
import { Bom, CompletionCertificate, Delivery, GoodsReceipt, Installation, Invoice, Payment, PurchaseOrder, StockItem, StockMovement } from '../models/operations.js';
import { ProjectBudget, ProjectCost, ChangeOrder } from '../models/costing.js';
import { Lead, FollowUp } from '../models/crm.js';
import { ServiceTicket, Warranty } from '../models/service.js';

export const branchesRouter = Router();
const objectId = z.string().regex(/^[a-f\d]{24}$/i);

branchesRouter.get('/warehouses', async (request, response, next) => {
  try {
    response.json({ data: await Warehouse.find(tenantFilter(request.auth!)).populate('branchId', 'name code').sort({ name: 1 }).lean() });
  } catch (error) { next(error); }
});

branchesRouter.post('/warehouses', requirePermission('users.manage'), async (request, response, next) => {
  try {
    const input = z.object({ branchId: objectId, code: z.string().trim().min(2).max(20), name: z.string().trim().min(2).max(100), address: z.string().max(500).optional(), isDefault: z.boolean().default(false) }).parse(request.body);
    const branch = await Branch.findOne({ _id: input.branchId, organizationId: request.auth!.organizationId });
    if (!branch) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    if (input.isDefault) await Warehouse.updateMany({ organizationId: request.auth!.organizationId, branchId: branch._id }, { $set: { isDefault: false } });
    const data = await Warehouse.create({ ...input, code: input.code.toUpperCase(), organizationId: request.auth!.organizationId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

branchesRouter.get('/transfers', requirePermission('users.manage'), async (request, response, next) => {
  try {
    response.json({ data: await BranchTransfer.find({ organizationId: request.auth!.organizationId }).populate('fromBranchId toBranchId', 'name code').populate('transferredBy', 'name').sort({ createdAt: -1 }).limit(200).lean() });
  } catch (error) { next(error); }
});

branchesRouter.post('/transfers', requirePermission('users.manage'), async (request, response, next) => {
  const session = await mongoose.startSession();
  try {
    const input = z.object({ entityType: z.enum(['client', 'project', 'quote', 'measurement', 'delivery', 'installation', 'service']), entityId: objectId, toBranchId: objectId, reason: z.string().trim().min(3).max(500) }).parse(request.body);
    const organizationId = request.auth!.organizationId;
    const destination = await Branch.findOne({ _id: input.toBranchId, organizationId, isActive: true }).lean();
    if (!destination) throw new ApiError(404, 'Destination branch not found', 'BRANCH_NOT_FOUND');
    const modelMap = { client: Client, project: Project, quote: Quote, measurement: MeasurementItem, delivery: Delivery, installation: Installation, service: ServiceTicket } as const;
    const EntityModel = modelMap[input.entityType] as unknown as mongoose.Model<{ branchId?: mongoose.Types.ObjectId }>;
    const record = await EntityModel.findOne({ _id: input.entityId, organizationId }).lean() as { _id: mongoose.Types.ObjectId; branchId?: mongoose.Types.ObjectId } | null;
    if (!record) throw new ApiError(404, 'Business record not found', 'RECORD_NOT_FOUND');
    let movedRecords = 0;
    await session.withTransaction(async () => {
      const setBranch = { $set: { branchId: destination._id, updatedBy: request.auth!.userId } };
      const result = await EntityModel.updateOne({ _id: record._id, organizationId }, setBranch, { session });
      movedRecords += result.modifiedCount;
      if (input.entityType === 'project') {
        const projectId = record._id;
        const quotes = await Quote.find({ organizationId, projectId }).select('_id').session(session).lean();
        const quoteIds = quotes.map((quote) => quote._id);
        const operations = await Promise.all([
          MeasurementItem.updateMany({ organizationId, projectId }, setBranch, { session }), Quote.updateMany({ organizationId, projectId }, setBranch, { session }),
          Delivery.updateMany({ organizationId, projectId }, setBranch, { session }), Installation.updateMany({ organizationId, projectId }, setBranch, { session }),
          CompletionCertificate.updateMany({ organizationId, projectId }, setBranch, { session }), PurchaseOrder.updateMany({ organizationId, projectId }, setBranch, { session }),
          StockMovement.updateMany({ organizationId, projectId }, setBranch, { session }), ProjectBudget.updateMany({ organizationId, projectId }, setBranch, { session }),
          ProjectCost.updateMany({ organizationId, projectId }, setBranch, { session }), ChangeOrder.updateMany({ organizationId, projectId }, setBranch, { session }),
          Warranty.updateMany({ organizationId, projectId }, setBranch, { session }), ServiceTicket.updateMany({ organizationId, projectId }, setBranch, { session }),
          Bom.updateMany({ organizationId, quoteId: { $in: quoteIds } }, setBranch, { session }), Invoice.updateMany({ organizationId, quoteId: { $in: quoteIds } }, setBranch, { session }), Payment.updateMany({ organizationId, quoteId: { $in: quoteIds } }, setBranch, { session }),
        ]);
        movedRecords += operations.reduce((sum, operation) => sum + operation.modifiedCount, 0);
      } else if (input.entityType === 'quote') {
        const quoteId = record._id;
        const operations = await Promise.all([Bom.updateMany({ organizationId, quoteId }, setBranch, { session }), Invoice.updateMany({ organizationId, quoteId }, setBranch, { session }), Payment.updateMany({ organizationId, quoteId }, setBranch, { session })]);
        movedRecords += operations.reduce((sum, operation) => sum + operation.modifiedCount, 0);
      }
      await BranchTransfer.create([{ organizationId, entityType: input.entityType, entityId: record._id, fromBranchId: record.branchId, toBranchId: destination._id, reason: input.reason, movedRecords, transferredBy: request.auth!.userId }], { session });
    });
    response.json({ data: { transferred: true, movedRecords, destination } });
  } catch (error) { next(error); } finally { await session.endSession(); }
});

branchesRouter.post('/stock-transfer', requirePermission('inventory.manage'), async (request, response, next) => {
  const session = await mongoose.startSession();
  try {
    const input = z.object({ catalogItemId: objectId, fromWarehouseId: objectId, toWarehouseId: objectId, quantity: z.number().positive(), notes: z.string().max(500).optional() }).parse(request.body);
    const organizationId = request.auth!.organizationId;
    const [from, to] = await Promise.all([Warehouse.findOne({ _id: input.fromWarehouseId, organizationId, isActive: true }), Warehouse.findOne({ _id: input.toWarehouseId, organizationId, isActive: true })]);
    if (!from || !to) throw new ApiError(404, 'Warehouse not found', 'WAREHOUSE_NOT_FOUND');
    await session.withTransaction(async () => {
      const source = await StockItem.findOne({ organizationId, branchId: from.branchId, catalogItemId: input.catalogItemId, warehouse: from.code }).session(session);
      if (!source || source.onHand - source.allocated < input.quantity) throw new ApiError(409, 'Insufficient available stock', 'INSUFFICIENT_STOCK');
      source.onHand -= input.quantity; await source.save({ session });
      await StockItem.findOneAndUpdate({ organizationId, branchId: to.branchId, catalogItemId: input.catalogItemId, warehouse: to.code }, { $inc: { onHand: input.quantity }, $setOnInsert: { unit: source.unit, allocated: 0, reorderLevel: 0, createdBy: request.auth!.userId }, $set: { updatedBy: request.auth!.userId } }, { upsert: true, new: true, session });
      await StockMovement.create([{ organizationId, branchId: from.branchId, catalogItemId: input.catalogItemId, type: 'transfer', fromWarehouse: from.code, toWarehouse: to.code, quantity: input.quantity, unit: source.unit, reference: `BRANCH:${from.branchId}->${to.branchId}`, notes: input.notes, createdBy: request.auth!.userId, updatedBy: request.auth!.userId }], { session });
    });
    response.json({ data: { transferred: true } });
  } catch (error) { next(error); } finally { await session.endSession(); }
});
