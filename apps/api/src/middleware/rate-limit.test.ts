import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { errorHandler } from './error-handler.js';
import { rateLimit, resetRateLimitsForTests } from './rate-limit.js';

describe('rateLimit', () => {
  beforeEach(() => resetRateLimitsForTests());

  it('returns 429 after the configured request limit', async () => {
    const testApp = express();
    testApp.use(rateLimit({ windowMs: 60_000, max: 2, keyPrefix: 'test' }));
    testApp.get('/', (_request, response) => response.json({ ok: true }));
    testApp.use(errorHandler);
    expect((await request(testApp).get('/')).status).toBe(200);
    expect((await request(testApp).get('/')).status).toBe(200);
    const blocked = await request(testApp).get('/');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
