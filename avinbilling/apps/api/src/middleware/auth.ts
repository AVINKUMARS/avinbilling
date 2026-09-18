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
    request.auth = {
      userId: new Types.ObjectId(payload.sub),
      organizationId: new Types.ObjectId(payload.organizationId),
      role: payload.role,
      permissions: payload.permissions,
      branchIds: (payload.branchIds ?? []).map((id) => new Types.ObjectId(id)),
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
