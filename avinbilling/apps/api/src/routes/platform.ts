import { Router } from 'express';
import { moduleCatalog } from '@avin/module-registry';
import { industryPackCatalog } from '@avin/industry-packs';

export const platformRouter = Router();

platformRouter.get('/modules', (_request, response) => response.json({ data: moduleCatalog }));
platformRouter.get('/industry-packs', (_request, response) => response.json({ data: industryPackCatalog }));
