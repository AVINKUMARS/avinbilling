import type { NextFunction, Request, Response } from 'express';
import { auditMutation } from '../services/audit.js';

export function auditTrail(request: Request, response: Response, next: NextFunction) {
  response.on('finish', () => { void auditMutation(request, response.statusCode).catch(() => undefined); });
  next();
}
