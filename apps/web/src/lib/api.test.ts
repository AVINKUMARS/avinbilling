// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { cacheResponse, queueMutation } from '../offline/database';
vi.mock('../offline/database', () => ({ cacheResponse: vi.fn(), queueMutation: vi.fn(), readCachedResponse: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); vi.stubGlobal('fetch', vi.fn()); vi.mocked(cacheResponse).mockResolvedValue(undefined); });
describe('request feedback', () => {
  it('reports the invalid field from server validation details', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Request validation failed', details: { fieldErrors: { name: ['Must contain at least 2 characters'] } } } }), { status: 400 }));
    await expect(apiRequest('/catalog/items', { method: 'POST', body: '{}' })).rejects.toThrow('name: Must contain at least 2 characters');
    expect(queueMutation).not.toHaveBeenCalled();
  });
  it('returns the fresh server list even when browser cache storage fails', async () => {
    vi.mocked(cacheResponse).mockRejectedValue(new Error('Storage quota exceeded'));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: [{ name: 'New product' }] })));
    await expect(apiRequest('/catalog/items')).resolves.toEqual([{ name: 'New product' }]);
  });
});
