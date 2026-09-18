import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from './error-handler.js';

type TokenPayload = {
  sub: string;
  organizationId: string;
  role: string;
  permissions: string[];
  branchIds?: string[];
};

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    const branchIds = (payload.branchIds ?? []).map((id) => new Types.ObjectId(id));
    let activeBranchId: Types.ObjectId | undefined;
    const activeBranchHeader = request.headers['x-active-branch'];
    if (activeBranchHeader && typeof activeBranchHeader === 'string' && activeBranchHeader !== 'all') {
      try {
        const requestedId = new Types.ObjectId(activeBranchHeader);
        if (payload.role === 'owner' || payload.role === 'admin' || branchIds.some((b) => b.equals(requestedId))) {
          activeBranchId = requestedId;
        }
      } catch {}
    }

    request.auth = {
      userId: new Types.ObjectId(payload.sub),
      organizationId: new Types.ObjectId(payload.organizationId),
      role: payload.role,
      permissions: payload.permissions,
      branchIds,
      activeBranchId,
    };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token', 'INVALID_TOKEN'));
  }
}

export function requirePermission(permission: string) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const auth = request.auth;
    if (!auth) return next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));
    if (auth.role === 'owner' || auth.role === 'admin' || auth.permissions.includes(permission)) return next();
    return next(new ApiError(403, 'You do not have permission for this action', 'FORBIDDEN'));
  };
}

export function tenantFilter(auth: NonNullable<Request['auth']>) {
  const filter: Record<string, any> = { organizationId: auth.organizationId };
  if (auth.activeBranchId) {
    filter.branchId = auth.activeBranchId;
  } else if (auth.role !== 'owner' && auth.role !== 'admin') {
    filter.branchId = { $in: auth.branchIds };
  }
  return filter;
}
