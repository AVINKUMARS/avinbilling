import { describe, expect, it } from 'vitest';
import { resolveModules } from './index.js';

describe('module registry', () => {
  it('automatically includes dependencies', () => {
    expect(resolveModules(['inventory'])).toEqual(['catalog', 'purchasing', 'inventory']);
  });
});
