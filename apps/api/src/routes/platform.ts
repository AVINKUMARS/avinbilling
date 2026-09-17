import { Router } from 'express';
import { moduleCatalog } from '@meera/module-registry';
import { upvcPack } from '@meera/industry-upvc';

export const platformRouter = Router();

platformRouter.get('/modules', (_request, response) => response.json({ data: moduleCatalog }));
platformRouter.get('/industry-packs', (_request, response) => response.json({ data: [upvcPack] }));
