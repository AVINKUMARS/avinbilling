import { Router } from 'express';
import { z } from 'zod';
import { areaSquareFeet } from '@meera/shared';
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
