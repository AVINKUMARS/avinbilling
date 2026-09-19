// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workspace } from './Workspace';
import { SaveForm } from './SaveForm';
import { apiRequest } from '../lib/api';

vi.mock('../lib/api', () => ({ apiRequest: vi.fn(), apiBaseUrl: '/api/v1' }));
vi.mock('./ConnectivityBadge', () => ({ ConnectivityBadge: () => null }));
vi.mock('./RuntimeFields', () => ({ RuntimeFields: () => null, RuntimeRecordFields: () => null, extractCustomValues: (form: HTMLFormElement) => { form.querySelectorAll('input'); return {}; } }));
const request = vi.mocked(apiRequest);
let host: HTMLDivElement;
let root: Root;
let products: unknown[];
let failSummary: boolean;
let failCreate: boolean;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  products = []; failSummary = false; failCreate = false;
  request.mockReset();
  request.mockImplementation(async (path, options = {}) => {
    if (options.method === 'POST') {
      if (failCreate) throw new Error('Product code already exists');
      const item = { _id: 'saved-item', ...JSON.parse(String(options.body)) };
      if (path === '/catalog/items') products.push(item);
      return item;
    }
    if (path === '/dashboard/summary') {
      if (failSummary) throw new Error('Reports unavailable');
      return { customers: 0, projects: 0, quotations: 0, brands: 0, outstandingPaise: 0 };
    }
    if (path === '/organization/settings') throw new Error('No theme');
    if (path === '/catalog/items') return [...products];
    return [];
  });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function renderWorkspace() { await act(async () => root.render(<Workspace user={{ id: 'u', name: 'Test', email: 'test@example.com' }} onLogout={() => {}} />)); }
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(el => el.textContent?.trim() === label);
  expect(button, `Button ${label}`).toBeTruthy(); await act(async () => button!.click());
}
async function openProduct() { await renderWorkspace(); await click('Products'); await click('Add product'); }
async function submitProduct() {
  const form = host.querySelector('[role="dialog"] form') as HTMLFormElement;
  for (const [name, value] of Object.entries({ name: 'Test material', code: 'TEST-01', categoryKey: 'hardware' })) (form.elements.namedItem(name) as HTMLInputElement).value = value;
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
describe('workspace save flows', () => {
  it('adds a product, closes the form, refreshes the list and confirms success', async () => {
    await openProduct(); await submitProduct();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('Test material');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Saved successfully');
  });
  it('retains entered values and shows the server error when saving fails', async () => {
    await openProduct(); failCreate = true; await submitProduct();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Product code already exists');
    expect((host.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('Test material');
    expect(host.querySelector('fieldset')?.disabled).toBe(false);
  });
  it('refreshes products even when the dashboard request fails', async () => {
    failSummary = true; await openProduct(); await submitProduct();
    expect(host.textContent).toContain('Test material');
    expect(host.textContent).toContain('Reports unavailable');
  });
  it('reads customer custom fields before the async request completes', async () => {
    await renderWorkspace(); await click('Customers'); await click('Add customer');
    const form = host.querySelector('[role="dialog"] form') as HTMLFormElement;
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('Saved successfully');
  });
  it('blocks repeated submissions while saving', async () => {
    let complete!: () => void;
    const save = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
    await act(async () => root.render(<SaveForm onSubmit={save}><input name="name"/><button>Save</button></SaveForm>));
    const form = host.querySelector('form')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(host.querySelector('fieldset')?.disabled).toBe(true);
    await act(async () => complete());
    expect(host.querySelector('fieldset')?.disabled).toBe(false);
  });
});
