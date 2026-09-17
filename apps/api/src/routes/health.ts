import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  const databaseStates = ['disconnected', 'connected', 'connecting', 'disconnecting'] as const;
  response.json({
    status: 'ok',
    service: 'avin-api',
    database: databaseStates.at(mongoose.connection.readyState) ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});
