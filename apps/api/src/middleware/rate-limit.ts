import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error-handler.js';

type Counter = { count: number; resetsAt: number };
const counters = new Map<string, Counter>();

export function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }) {
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`;
    const current = counters.get(key);
    const counter = !current || current.resetsAt <= now ? { count: 0, resetsAt: now + options.windowMs } : current;
    counter.count += 1;
    counters.set(key, counter);
    response.setHeader('X-RateLimit-Limit', options.max);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - counter.count));
    response.setHeader('X-RateLimit-Reset', Math.ceil(counter.resetsAt / 1000));
    if (counter.count > options.max) return next(new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED'));
    next();
  };
}

export function resetRateLimitsForTests() {
  counters.clear();
}
