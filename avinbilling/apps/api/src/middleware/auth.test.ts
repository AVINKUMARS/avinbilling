import type { Request } from 'express';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { tenantFilter } from './auth.js';

type AuthContext = NonNullable<Request['auth']>;

function auth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: new Types.ObjectId('64b000000000000000000001'),
    organizationId: new Types.ObjectId('64b000000000000000000002'),
    role: 'sales',
    permissions: [],
    branchIds: [
      new Types.ObjectId('64b000000000000000000003'),
      new Types.ObjectId('64b000000000000000000004'),
    ],
    ...overrides,
  };
}

describe('tenantFilter', () => {
  it('restricts a regular user to assigned branches when no branch is selected', () => {
    const context = auth();
    expect(tenantFilter(context)).toEqual({
      organizationId: context.organizationId,
      branchId: { $in: context.branchIds },
    });
  });

  it('restricts a request to the selected active branch', () => {
    const activeBranchId = new Types.ObjectId('64b000000000000000000003');
    const context = auth({ activeBranchId });
    expect(tenantFilter(context)).toEqual({
      organizationId: context.organizationId,
      branchId: activeBranchId,
    });
  });

  it('allows an owner to view all organization branches when none is selected', () => {
    const context = auth({ role: 'owner' });
    expect(tenantFilter(context)).toEqual({ organizationId: context.organizationId });
  });
});
