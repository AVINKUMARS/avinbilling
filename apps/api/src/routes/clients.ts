import { Router } from 'express';
import { clientSchema } from '@avin/shared';
import { Client } from '../models/client.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const clientRouter = Router();
clientRouter.use(requireAuth);

clientRouter.get('/', async (request, response, next) => {
  try {
    const clients = await Client.find({ organizationId: request.auth!.organizationId, isActive: true })
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
    const count = await Client.countDocuments({ organizationId: request.auth!.organizationId });
    const client = await Client.create({
      ...input,
      clientCode: `CLI-${String(count + 1).padStart(5, '0')}`,
      organizationId: request.auth!.organizationId,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });
    response.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
});
