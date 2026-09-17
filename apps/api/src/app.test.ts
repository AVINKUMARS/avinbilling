import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app.js';

describe('public platform API', () => {
  it('reports service health without exposing secrets', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns the module catalog', async () => {
    const response = await request(app).get('/api/v1/platform/modules');
    expect(response.status).toBe(200);
    expect(response.body.data.some((module: { key: string }) => module.key === 'quotations')).toBe(true);
  });
});
