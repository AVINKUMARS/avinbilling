import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { requirePermission, tenantFilter } from '../middleware/auth.js';
import { ApiError } from '../middleware/error-handler.js';
import { Attachment, Notification, NotificationPreference } from '../models/files.js';
import { resolveWriteBranch } from '../services/branching.js';

export const filesRouter = Router();
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const uploadRoot = path.resolve(process.cwd(), 'data', 'uploads');
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'text/csv']);

filesRouter.get('/attachments', async (request, response, next) => {
  try {
    const query = z.object({ entityType: z.string().optional(), entityId: objectId.optional() }).parse(request.query);
    response.json({ data: await Attachment.find({ ...tenantFilter(request.auth!), status: 'active', ...(query.entityType ? { entityType: query.entityType } : {}), ...(query.entityId ? { entityId: query.entityId } : {}) }).populate('uploadedBy', 'name').sort({ createdAt: -1 }).limit(300).lean() });
  } catch (error) { next(error); }
});

filesRouter.post('/attachments', requirePermission('files.manage'), async (request, response, next) => {
  try {
    const input = z.object({ entityType: z.enum(['client', 'project', 'measurement', 'quote', 'delivery', 'installation', 'service']), entityId: objectId, category: z.enum(['document', 'site_photo', 'measurement_photo', 'delivery_proof', 'installation_proof', 'other']).default('document'), fileName: z.string().trim().min(1).max(180), mimeType: z.string(), dataBase64: z.string().min(1), description: z.string().max(500).optional() }).parse(request.body);
    if (!allowedMime.has(input.mimeType)) throw new ApiError(415, 'Unsupported file type', 'UNSUPPORTED_FILE');
    const buffer = Buffer.from(input.dataBase64, 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new ApiError(413, 'File must be smaller than 5 MB', 'FILE_TOO_LARGE');
    const branchId = await resolveWriteBranch(request.auth!);
    const extension = path.extname(input.fileName).replace(/[^.a-z0-9]/gi, '').slice(0, 10);
    const storageKey = `${request.auth!.organizationId}/${randomUUID()}${extension}`;
    const absolutePath = path.resolve(uploadRoot, storageKey);
    if (!absolutePath.startsWith(uploadRoot)) throw new ApiError(400, 'Invalid file path', 'INVALID_FILE');
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer, { flag: 'wx' });
    const data = await Attachment.create({ ...input, dataBase64: undefined, organizationId: request.auth!.organizationId, branchId, storageKey, size: buffer.length, checksum: createHash('sha256').update(buffer).digest('hex'), uploadedBy: request.auth!.userId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

filesRouter.get('/attachments/:id/content', async (request, response, next) => {
  try {
    const attachment = await Attachment.findOne({ _id: request.params.id, ...tenantFilter(request.auth!), status: 'active' }).lean();
    if (!attachment) throw new ApiError(404, 'Attachment not found', 'ATTACHMENT_NOT_FOUND');
    const absolutePath = path.resolve(uploadRoot, attachment.storageKey);
    if (!absolutePath.startsWith(uploadRoot)) throw new ApiError(400, 'Invalid file path', 'INVALID_FILE');
    const content = await readFile(absolutePath);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="${attachment.fileName.replace(/["\\]/g, '_')}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(content);
  } catch (error) { next(error); }
});

filesRouter.delete('/attachments/:id', requirePermission('files.manage'), async (request, response, next) => {
  try {
    const attachment = await Attachment.findOneAndUpdate({ _id: request.params.id, ...tenantFilter(request.auth!), status: 'active' }, { $set: { status: 'archived', updatedBy: request.auth!.userId } }, { new: true });
    if (!attachment) throw new ApiError(404, 'Attachment not found', 'ATTACHMENT_NOT_FOUND');
    const absolutePath = path.resolve(uploadRoot, attachment.storageKey);
    if (absolutePath.startsWith(uploadRoot)) await unlink(absolutePath).catch(() => undefined);
    response.json({ data: { archived: true } });
  } catch (error) { next(error); }
});

filesRouter.get('/notifications', async (request, response, next) => {
  try {
    const visibility: Array<Record<string, unknown>> = [{ $or: [{ userId: request.auth!.userId }, { userId: { $exists: false } }] }];
    if (request.auth!.activeBranchId) visibility.push({ $or: [{ branchId: request.auth!.activeBranchId }, { branchId: { $exists: false } }] });
    response.json({ data: await Notification.find({ organizationId: request.auth!.organizationId, $and: visibility }).sort({ createdAt: -1 }).limit(200).lean() });
  } catch (error) { next(error); }
});

filesRouter.post('/notifications', requirePermission('notifications.send'), async (request, response, next) => {
  try {
    const input = z.object({ userId: objectId.optional(), event: z.string().trim().min(2).max(80), title: z.string().trim().min(2).max(120), message: z.string().trim().min(2).max(1000), link: z.string().max(500).optional(), channels: z.array(z.enum(['in_app', 'email', 'whatsapp'])).min(1), scheduledFor: z.coerce.date().optional() }).parse(request.body);
    const branchId = await resolveWriteBranch(request.auth!);
    const deliveryStatus = Object.fromEntries(input.channels.map((channel) => [channel, channel === 'in_app' ? 'delivered' : 'ready_to_share']));
    const data = await Notification.create({ ...input, organizationId: request.auth!.organizationId, branchId, deliveryStatus, createdBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

filesRouter.patch('/notifications/:id/read', async (request, response, next) => {
  try {
    const data = await Notification.findOneAndUpdate({ _id: request.params.id, organizationId: request.auth!.organizationId, $or: [{ userId: request.auth!.userId }, { userId: { $exists: false } }] }, { $set: { readAt: new Date() } }, { new: true });
    if (!data) throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
    response.json({ data });
  } catch (error) { next(error); }
});

filesRouter.get('/preferences', async (request, response, next) => {
  try {
    const data = await NotificationPreference.findOneAndUpdate({ organizationId: request.auth!.organizationId, userId: request.auth!.userId }, { $setOnInsert: {} }, { upsert: true, new: true, setDefaultsOnInsert: true });
    response.json({ data });
  } catch (error) { next(error); }
});

filesRouter.put('/preferences', async (request, response, next) => {
  try {
    const input = z.object({ inApp: z.boolean(), email: z.boolean(), whatsapp: z.boolean(), paymentReminders: z.boolean(), followUpReminders: z.boolean(), serviceReminders: z.boolean() }).parse(request.body);
    const data = await NotificationPreference.findOneAndUpdate({ organizationId: request.auth!.organizationId, userId: request.auth!.userId }, { $set: input }, { upsert: true, new: true, setDefaultsOnInsert: true });
    response.json({ data });
  } catch (error) { next(error); }
});

filesRouter.post('/share-links', async (request, response, next) => {
  try {
    const input = z.object({ channel: z.enum(['whatsapp', 'email']), phone: z.string().max(30).optional(), email: z.string().email().optional(), subject: z.string().max(150).default('Avin Business Suite update'), message: z.string().max(1500) }).parse(request.body);
    const url = input.channel === 'whatsapp'
      ? `https://wa.me/${(input.phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(input.message)}`
      : `mailto:${encodeURIComponent(input.email ?? '')}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.message)}`;
    response.json({ data: { url } });
  } catch (error) { next(error); }
});
