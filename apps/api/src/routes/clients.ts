import { Router } from 'express';
import { clientSchema } from '@avin/shared';
import { Client } from '../models/client.js';
import { requireAuth, requirePermission, tenantFilter } from '../middleware/auth.js';
import { nextBranchNumber } from '../services/branching.js';

export const clientRouter = Router();
clientRouter.use(requireAuth);

clientRouter.get('/', async (request, response, next) => {
  try {
    const clients = await Client.find({ ...tenantFilter(request.auth!), isActive: true })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    response.json({ data: clients });
  } catch (error) {
    next(error);
  }
});

clientRouter.post('/', requirePermission('clients.create'), async (request, response, next) => {
  try {
    const input = clientSchema.parse(request.body);
    const sequence = await nextBranchNumber(request.auth!, 'client', 'CLI');
    const client = await Client.create({
      ...input,
      clientCode: sequence.number,
      organizationId: request.auth!.organizationId,
      branchId: sequence.branchId,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });
    response.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
});
