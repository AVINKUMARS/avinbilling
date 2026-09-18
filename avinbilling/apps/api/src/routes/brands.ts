import { Router } from 'express';
import { z } from 'zod';
import { Brand } from '../models/catalog.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const brandInput = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase()),
  companyName: z.string().trim().max(120).optional(),
  warrantyText: z.string().trim().max(500).optional(),
  colors: z.array(z.string().trim().min(1)).default([]),
  categories: z.array(z.string().trim().min(1)).default([]),
});

export const brandRouter = Router();
brandRouter.use(requireAuth);

brandRouter.get('/', async (request, response, next) => {
  try {
    const data = await Brand.find({ organizationId: request.auth!.organizationId, isActive: true }).sort({ name: 1 }).lean();
    response.json({ data });
  } catch (error) { next(error); }
});

brandRouter.post('/', requirePermission('catalog.create'), async (request, response, next) => {
  try {
    const input = brandInput.parse(request.body);
    const data = await Brand.create({ ...input, organizationId: request.auth!.organizationId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});
