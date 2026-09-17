import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Project } from '../models/project.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const projectInput = z.object({
  name: z.string().trim().min(2).max(160),
  clientId: z.string().regex(/^[a-f\d]{24}$/i),
  projectType: z.string().trim().min(2).max(80),
  siteAddress: z.string().trim().max(500).optional(),
});
const areaInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['building', 'floor', 'room', 'area']),
  parentLocalId: z.string().optional(),
});

export const projectRouter = Router();
projectRouter.use(requireAuth);

projectRouter.get('/', async (request, response, next) => {
  try {
    const data = await Project.find({ organizationId: request.auth!.organizationId })
      .populate('clientId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    response.json({ data });
  } catch (error) { next(error); }
});

projectRouter.post('/', requirePermission('projects.create'), async (request, response, next) => {
  try {
    const input = projectInput.parse(request.body);
    const count = await Project.countDocuments({ organizationId: request.auth!.organizationId });
    const data = await Project.create({
      ...input,
      projectNumber: `PRJ-${String(count + 1).padStart(5, '0')}`,
      organizationId: request.auth!.organizationId,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
      areas: [],
    });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

projectRouter.post('/:id/areas', requirePermission('projects.update'), async (request, response, next) => {
  try {
    const input = areaInput.parse(request.body);
    const project = await Project.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId });
    if (!project) { response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } }); return; }
    if (input.parentLocalId && !project.areas.some((area) => area.localId === input.parentLocalId)) {
      response.status(400).json({ error: { code: 'INVALID_PARENT', message: 'Parent project area does not exist' } }); return;
    }
    project.areas.push({ ...input, localId: randomUUID() });
    project.updatedBy = request.auth!.userId;
    await project.save();
    response.status(201).json({ data: project });
  } catch (error) { next(error); }
});
