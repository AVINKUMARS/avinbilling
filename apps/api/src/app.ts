import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { clientRouter } from './routes/clients.js';
import { healthRouter } from './routes/health.js';
import { platformRouter } from './routes/platform.js';
import { brandRouter } from './routes/brands.js';
import { projectRouter } from './routes/projects.js';
import { dashboardRouter } from './routes/dashboard.js';
import { catalogRouter } from './routes/catalog.js';
import { measurementRouter } from './routes/measurements.js';
import { calculationRouter } from './routes/calculations.js';
import { quoteRouter } from './routes/quotes.js';
import { operationsRouter } from './routes/operations.js';
import { organizationRouter } from './routes/organization.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (env.NODE_ENV !== 'test') app.use(pinoHttp());

app.get('/', (_request, response) => response.json({ name: 'Avin Business Suite API', version: '0.1.0' }));
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/platform', platformRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/clients', clientRouter);
app.use('/api/v1/brands', brandRouter);
app.use('/api/v1/projects', projectRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/catalog', catalogRouter);
app.use('/api/v1/measurements', measurementRouter);
app.use('/api/v1/calculations', calculationRouter);
app.use('/api/v1/quotes', quoteRouter);
app.use('/api/v1/operations', operationsRouter);
app.use('/api/v1/organization', organizationRouter);

app.use((_request, response) => response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
app.use(errorHandler);
