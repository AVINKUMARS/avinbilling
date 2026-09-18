import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, tenantFilter } from '../middleware/auth.js';
import { Warranty, ServiceTicket } from '../models/service.js';
import { Project } from '../models/project.js';
import { Client } from '../models/client.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const serviceRouter = Router();
serviceRouter.use(requireAuth);

const warrantyInput = z.object({
  projectId: objectId,
  installationId: objectId.optional(),
  catalogItemId: objectId.optional(),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  terms: z.string().max(2000).optional(),
});

serviceRouter.get('/warranties', async (request, response, next) => {
  try {
    const data = await Warranty.find(tenantFilter(request.auth!))
      .populate('projectId', 'name projectNumber')
      .sort({ expiryDate: 1 })
      .lean();
    response.json({ data });
  } catch (error) { next(error); }
});

serviceRouter.post('/warranties', requirePermission('installation.create'), async (request, response, next) => {
  try {
    const input = warrantyInput.parse(request.body);
    const count = await Warranty.countDocuments(tenantFilter(request.auth!));
    const data = await Warranty.create({
      ...input,
      ...tenantFilter(request.auth!),
      warrantyNumber: `WAR-${String(count + 1).padStart(5, '0')}`,
      branchId: request.auth!.activeBranchId,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

const ticketInput = z.object({
  clientId: objectId,
  projectId: objectId.optional(),
  warrantyId: objectId.optional(),
  description: z.string().min(5).max(2000),
});

serviceRouter.get('/tickets', async (request, response, next) => {
  try {
    const data = await ServiceTicket.find(tenantFilter(request.auth!))
      .populate('clientId', 'name phone')
      .populate('projectId', 'name projectNumber')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .lean();
    response.json({ data });
  } catch (error) { next(error); }
});

serviceRouter.post('/tickets', requirePermission('installation.create'), async (request, response, next) => {
  try {
    const input = ticketInput.parse(request.body);
    const count = await ServiceTicket.countDocuments(tenantFilter(request.auth!));
    const data = await ServiceTicket.create({
      ...input,
      ...tenantFilter(request.auth!),
      ticketNumber: `SRV-${String(count + 1).padStart(5, '0')}`,
      branchId: request.auth!.activeBranchId,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

serviceRouter.patch('/tickets/:id/schedule', requirePermission('installation.create'), async (request, response, next) => {
  try {
    const input = z.object({
      assignedTo: objectId,
      scheduledAt: z.coerce.date(),
    }).parse(request.body);
    
    const data = await ServiceTicket.findOneAndUpdate(
      { _id: objectId.parse(request.params.id), ...tenantFilter(request.auth!) },
      { 
        $set: { 
          assignedTo: input.assignedTo, 
          scheduledAt: input.scheduledAt, 
          status: 'scheduled',
          updatedBy: request.auth!.userId 
        } 
      },
      { new: true }
    );
    if (!data) { response.status(404).json({ error: { message: "Service ticket not found" } }); return; }
    response.json({ data });
  } catch (error) { next(error); }
});

serviceRouter.post('/tickets/:id/resolve', requirePermission('installation.create'), async (request, response, next) => {
  try {
    const input = z.object({
      serviceChargePaise: z.number().int().min(0).default(0),
      customerSignatory: z.string().min(2).max(120),
      customerSignature: z.string().min(2).max(20000),
      notes: z.string().max(2000).optional(),
      partsUsed: z.array(z.object({
        catalogItemId: objectId,
        quantity: z.number().positive(),
      })).default([]),
    }).parse(request.body);

    const data = await ServiceTicket.findOneAndUpdate(
      { _id: objectId.parse(request.params.id), ...tenantFilter(request.auth!) },
      { 
        $set: { 
          ...input,
          status: 'resolved',
          resolvedAt: new Date(),
          updatedBy: request.auth!.userId 
        } 
      },
      { new: true }
    );
    if (!data) { response.status(404).json({ error: { message: "Service ticket not found" } }); return; }
    response.json({ data });
  } catch (error) { next(error); }
});
