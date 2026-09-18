import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'API_ERROR',
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.flatten() },
    });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
};
