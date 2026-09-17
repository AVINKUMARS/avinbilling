import { Router } from 'express';
import { z } from 'zod';
import { CatalogItem, RateCard } from '../models/catalog.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const itemInput = z.object({
  categoryKey: z.string().trim().min(2).max(60),
  brandId: z.string().regex(/^[a-f\d]{24}$/i).optional().or(z.literal('')),
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  itemType: z.enum(['product', 'material', 'component', 'hardware', 'service']),
  unit: z.enum(['qty', 'sqft', 'rft', 'metre', 'kg', 'sheet', 'bar', 'hour', 'fixed']),
});

const rateCardInput = z.object({
  name: z.string().trim().min(2).max(120),
  customerType: z.enum(['retail', 'dealer', 'builder', 'project', 'custom']),
  effectiveFrom: z.coerce.date(),
  defaultWastagePercent: z.number().min(0).max(100),
  lines: z.array(z.object({
    catalogItemId: z.string().regex(/^[a-f\d]{24}$/i),
    purchaseRatePaise: z.number().int().min(0),
    sellingRatePaise: z.number().int().min(0),
    wastagePercent: z.number().min(0).max(100).default(0),
  })).min(1),
});

export const catalogRouter = Router();
catalogRouter.use(requireAuth);

catalogRouter.get('/items', async (request, response, next) => {
  try {
    const data = await CatalogItem.find({ organizationId: request.auth!.organizationId, isActive: true }).populate('brandId', 'name code').sort({ categoryKey: 1, name: 1 }).lean();
    response.json({ data });
  } catch (error) { next(error); }
});

catalogRouter.post('/items', requirePermission('catalog.create'), async (request, response, next) => {
  try {
    const input = itemInput.parse(request.body);
    const data = await CatalogItem.create({ ...input, brandId: input.brandId || undefined, organizationId: request.auth!.organizationId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

catalogRouter.get('/rate-cards', async (request, response, next) => {
  try {
    const data = await RateCard.find({ organizationId: request.auth!.organizationId }).populate('lines.catalogItemId', 'name code unit').sort({ createdAt: -1 }).lean();
    response.json({ data });
  } catch (error) { next(error); }
});

catalogRouter.post('/rate-cards', requirePermission('rates.create'), async (request, response, next) => {
  try {
    const input = rateCardInput.parse(request.body);
    const latest = await RateCard.findOne({ organizationId: request.auth!.organizationId, name: input.name }).sort({ version: -1 }).lean();
    const data = await RateCard.create({ ...input, version: (latest?.version ?? 0) + 1, organizationId: request.auth!.organizationId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

catalogRouter.post('/rate-cards/:id/activate', requirePermission('rates.activate'), async (request, response, next) => {
  try {
    const card = await RateCard.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId });
    if (!card) { response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rate card not found' } }); return; }
    await RateCard.updateMany({ organizationId: request.auth!.organizationId, name: card.name, status: 'active' }, { status: 'archived', effectiveTo: new Date() });
    card.status = 'active'; await card.save();
    response.json({ data: card });
  } catch (error) { next(error); }
});
