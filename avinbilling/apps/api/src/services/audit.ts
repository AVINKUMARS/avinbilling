import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { ActivityLog } from '../models/access.js';

function safeMetadata(body: unknown) {
  if (!body || typeof body !== 'object') return undefined;
  const blocked = /password|token|secret|signature|base64|fileData/i;
  return Object.fromEntries(Object.entries(body as Record<string, unknown>)
    .filter(([key]) => !blocked.test(key))
    .slice(0, 30)
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value]));
}

export async function appendAudit(input: {
  organizationId: unknown;
  userId?: unknown;
  action: string;
  description: string;
  subjectType?: string;
  subjectId?: string;
  metadata?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  const previous = await ActivityLog.findOne({ organizationId: input.organizationId }).sort({ createdAt: -1 }).select('recordHash').lean();
  const previousHash = previous?.recordHash ?? 'GENESIS';
  const occurredAt = new Date();
  const canonical = JSON.stringify({ previousHash, action: input.action, description: input.description, subjectType: input.subjectType, subjectId: input.subjectId, metadata: input.metadata, organizationId: String(input.organizationId), userId: String(input.userId ?? ''), occurredAt: occurredAt.toISOString() });
  return ActivityLog.create({ ...input, occurredAt, previousHash, recordHash: createHash('sha256').update(canonical).digest('hex') });
}

export function auditMutation(request: Request, statusCode: number) {
  if (!request.auth || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || statusCode >= 400) return Promise.resolve();
  return appendAudit({
    organizationId: request.auth.organizationId,
    userId: request.auth.userId,
    action: `api.${request.method.toLowerCase()}`,
    subjectType: request.path.split('/').filter(Boolean)[0] ?? 'api',
    subjectId: Array.isArray(request.params.id) ? request.params.id[0] : request.params.id,
    description: `${request.method} ${request.originalUrl}`,
    metadata: safeMetadata(request.body),
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  });
}
