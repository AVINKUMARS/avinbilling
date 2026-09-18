import { Router } from 'express';
import { z } from 'zod';
import { areaSquareFeet } from '@avin/shared';
import { MeasurementItem } from '../models/measurement.js';
import { Project } from '../models/project.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const inputSchema = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i),
  areaLocalId: z.string().optional(),
  location: z.string().trim().min(1).max(120),
  categoryKey: z.string().trim().min(2).max(60),
  itemType: z.string().trim().min(2).max(100),
  widthMm: z.number().int().positive().max(20_000),
  heightMm: z.number().int().positive().max(20_000),
  quantity: z.number().int().positive().max(1_000),
  notes: z.string().trim().max(1_000).optional(),
  attributes: z.object({
    configurationType: z.string().trim().max(100).optional(),
    openingDirection: z.enum(['left', 'right', 'both', 'fixed', 'top', 'inside', 'outside']).optional(),
    color: z.string().trim().max(60).optional(),
    profileBrandId: z.string().regex(/^[a-f\d]{24}$/i).optional().or(z.literal('')),
    glassBrandId: z.string().regex(/^[a-f\d]{24}$/i).optional().or(z.literal('')),
    hardwareBrandId: z.string().regex(/^[a-f\d]{24}$/i).optional().or(z.literal('')),
    glassType: z.string().trim().max(100).optional(),
    profileSystem: z.string().trim().max(100).optional(),
    installationChargePaise: z.number().int().min(0).default(0),
    transportChargePaise: z.number().int().min(0).default(0),
    extraChargePaise: z.number().int().min(0).default(0),
  }).optional(),
});

export const measurementRouter = Router();
measurementRouter.use(requireAuth);

measurementRouter.get('/', async (request, response, next) => {
  try {
    const filter: Record<string, unknown> = { organizationId: request.auth!.organizationId };
    if (typeof request.query.projectId === 'string') filter.projectId = request.query.projectId;
    const data = await MeasurementItem.find(filter).populate('projectId', 'name projectNumber areas').sort({ createdAt: -1 }).lean();
    response.json({ data });
  } catch (error) { next(error); }
});

measurementRouter.post('/', requirePermission('measurements.create'), async (request, response, next) => {
  try {
    const input = inputSchema.parse(request.body);
    const project = await Project.findOne({ _id: input.projectId, organizationId: request.auth!.organizationId }).lean();
    if (!project) { response.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } }); return; }
    if (input.areaLocalId && !project.areas.some((area) => area.localId === input.areaLocalId)) {
      response.status(400).json({ error: { code: 'AREA_NOT_FOUND', message: 'Selected project area was not found' } }); return;
    }
    const count = await MeasurementItem.countDocuments({ organizationId: request.auth!.organizationId, projectId: input.projectId });
    const data = await MeasurementItem.create({
      ...input,
      itemNumber: `M-${String(count + 1).padStart(4, '0')}`,
      areaSqft: Number(areaSquareFeet(input.widthMm, input.heightMm).toFixed(3)),
      organizationId: request.auth!.organizationId,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

measurementRouter.patch('/:id', requirePermission('measurements.create'), async (request, response, next) => {
  try {
    const input = inputSchema.partial().omit({ projectId: true }).parse(request.body);
    const existing = await MeasurementItem.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId });
    if (!existing) { response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Measurement not found' } }); return; }
    if (existing.status === 'locked') { response.status(409).json({ error: { code: 'LOCKED', message: 'Approved measurement cannot be changed' } }); return; }
    Object.assign(existing, input, { updatedBy: request.auth!.userId });
    if (input.widthMm || input.heightMm) existing.areaSqft = Number(areaSquareFeet(input.widthMm ?? existing.widthMm, input.heightMm ?? existing.heightMm).toFixed(3));
    await existing.save(); response.json({ data: existing });
  } catch (error) { next(error); }
});

measurementRouter.post('/:id/duplicate', requirePermission('measurements.create'), async (request, response, next) => {
  try {
    const source = await MeasurementItem.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId }).lean();
    if (!source) { response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Measurement not found' } }); return; }
    const count = await MeasurementItem.countDocuments({ organizationId: request.auth!.organizationId, projectId: source.projectId });
    const { _id, createdAt, updatedAt, ...copy } = source;
    const data = await MeasurementItem.create({ ...copy, itemNumber: `M-${String(count + 1).padStart(4, '0')}`, location: `${source.location} copy`, status: 'draft', createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

measurementRouter.delete('/:id', requirePermission('measurements.create'), async (request, response, next) => {
  try {
    const data = await MeasurementItem.findOneAndDelete({ _id: request.params.id, organizationId: request.auth!.organizationId, status: { $ne: 'locked' } });
    if (!data) { response.status(409).json({ error: { code: 'LOCKED', message: 'Locked measurement cannot be deleted' } }); return; }
    response.json({ data });
  } catch (error) { next(error); }
});
