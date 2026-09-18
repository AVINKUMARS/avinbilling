import type { Request } from 'express';
import { Branch, BranchSequence, Warehouse } from '../models/access.js';
import { ApiError } from '../middleware/error-handler.js';

type Auth = NonNullable<Request['auth']>;

export async function resolveWriteBranch(auth: Auth) {
  if (auth.activeBranchId) return auth.activeBranchId;
  if (auth.role !== 'owner' && auth.role !== 'admin') {
    if (auth.branchIds.length === 1) return auth.branchIds[0]!;
    throw new ApiError(400, 'Select an active branch before creating or changing a record', 'ACTIVE_BRANCH_REQUIRED');
  }
  let branch = await Branch.findOne({ organizationId: auth.organizationId, isActive: true }).sort({ createdAt: 1 });
  if (!branch) {
    branch = await Branch.create({ organizationId: auth.organizationId, code: 'MAIN', name: 'Main Branch', createdBy: auth.userId, updatedBy: auth.userId });
    await Warehouse.create({ organizationId: auth.organizationId, branchId: branch._id, code: 'MAIN', name: 'Main Warehouse', isDefault: true, createdBy: auth.userId, updatedBy: auth.userId });
  }
  return branch._id;
}

export async function nextBranchNumber(auth: Auth, key: string, prefix: string, digits = 5, includeYear = false) {
  const branchId = await resolveWriteBranch(auth);
  const branch = await Branch.findById(branchId).select('code').lean();
  if (!branch) throw new ApiError(400, 'Active branch no longer exists', 'BRANCH_NOT_FOUND');
  const sequenceKey = includeYear ? `${key}-${new Date().getFullYear()}` : key;
  const sequence = await BranchSequence.findOneAndUpdate(
    { organizationId: auth.organizationId, branchId, key: sequenceKey },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const year = includeYear ? `-${new Date().getFullYear()}` : '';
  return { branchId, number: `${branch.code}-${prefix}${year}-${String(sequence.value).padStart(digits, '0')}` };
}
