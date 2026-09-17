import { Router } from 'express';
import { moduleCatalog } from '@avin/module-registry';
import { upvcPack } from '@avin/industry-upvc';

export const platformRouter = Router();

platformRouter.get('/modules', (_request, response) => response.json({ data: moduleCatalog }));
platformRouter.get('/industry-packs', (_request, response) => response.json({ data: [upvcPack] }));
