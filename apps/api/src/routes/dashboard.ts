import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Client } from '../models/client.js';
import { Project } from '../models/project.js';
import { Quote } from '../models/quote.js';
import { Brand } from '../models/catalog.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/summary', async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const [customers, projects, quotations, brands] = await Promise.all([
      Client.countDocuments({ organizationId, isActive: true }),
      Project.countDocuments({ organizationId, status: { $nin: ['completed', 'cancelled'] } }),
      Quote.countDocuments({ organizationId, status: { $nin: ['declined', 'expired', 'cancelled'] } }),
      Brand.countDocuments({ organizationId, isActive: true }),
    ]);
    response.json({ data: { customers, projects, quotations, brands, outstandingPaise: 0 } });
  } catch (error) { next(error); }
});
