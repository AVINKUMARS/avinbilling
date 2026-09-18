import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { organizationBootstrapSchema, loginSchema } from '@avin/shared';
import { resolveModules } from '@avin/module-registry';
import type { ModuleKey } from '@avin/shared';
import { env } from '../config/env.js';
import { Membership, PasswordResetToken, RefreshSession, User } from '../models/user.js';
import { Organization } from '../models/organization.js';
import { ApiError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { ActivityLog, SecurityEvent, UserInvitation } from '../models/access.js';

export const authRouter = Router();

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const accessTokenAge = '15m';
const refreshMaxAge = 30 * 24 * 60 * 60 * 1000;

function readCookie(request: Parameters<typeof requireAuth>[0] extends never ? never : import('express').Request, name: string) {
  const cookies = request.headers.cookie?.split(';').map((entry) => entry.trim().split('=')) ?? [];
  return cookies.find(([key]) => key === name)?.slice(1).join('=');
}

async function issueSession(response: import('express').Response, request: import('express').Request, user: InstanceType<typeof User>, membership: InstanceType<typeof Membership>) {
  const token = jwt.sign({ sub: user.id, organizationId: membership.organizationId.toString(), role: membership.role, permissions: membership.permissions, branchIds: membership.branchIds.map((id) => id.toString()) }, env.JWT_SECRET, { expiresIn: accessTokenAge });
  const refreshToken = randomBytes(48).toString('base64url');
  await RefreshSession.create({ userId: user._id, organizationId: membership.organizationId, tokenHash: createHash('sha256').update(refreshToken).digest('hex'), expiresAt: new Date(Date.now() + refreshMaxAge), ipAddress: request.ip, userAgent: request.get('user-agent') });
  response.cookie('avin_refresh', refreshToken, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: refreshMaxAge, path: '/api/v1/auth' });
  return token;
}

authRouter.get('/setup-status', async (_request, response, next) => {
  try {
    const organizationCount = await Organization.countDocuments();
    response.json({ data: { bootstrapped: organizationCount > 0 } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/bootstrap', async (request, response, next) => {
  try {
    const input = organizationBootstrapSchema.parse(request.body);
    const existingOrganizations = await Organization.countDocuments();
    if (existingOrganizations > 0) throw new ApiError(409, 'Platform has already been bootstrapped', 'ALREADY_BOOTSTRAPPED');

    const session = await mongoose.startSession();
    let result: { organizationId: string; userId: string } | undefined;
    try {
      await session.withTransaction(async () => {
        const [organization] = await Organization.create([{
          name: input.organizationName,
          slug: slugify(input.organizationName),
          enabledModules: resolveModules(input.enabledModules as ModuleKey[]),
          industryPacks: input.industryPacks.map((key) => ({ key, version: 1, enabledAt: new Date() })),
        }], { session });
        const [user] = await User.create([{
          name: input.adminName,
          email: input.adminEmail,
          passwordHash: await bcrypt.hash(input.password, 12),
        }], { session });
        if (!organization || !user) throw new Error('Bootstrap creation failed');
        await Membership.create([{
          organizationId: organization._id,
          userId: user._id,
          role: 'owner',
          permissions: ['*'],
        }], { session });
        result = { organizationId: organization.id, userId: user.id };
      });
    } finally {
      await session.endSession();
    }
    response.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    const user = await User.findOne({ email: input.email }).select('+passwordHash');
    if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.get('passwordHash') as string))) {
      await SecurityEvent.create({ type: 'auth.login', severity: 'warning', success: false, ipAddress: request.ip, userAgent: request.get('user-agent'), description: `Failed sign-in attempt for ${input.email}` });
      throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const membership = await Membership.findOne({
      userId: user._id,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      isActive: true,
    });
    if (!membership) throw new ApiError(403, 'No active organization membership', 'NO_MEMBERSHIP');

    const token = await issueSession(response, request, user, membership);

    user.lastLoginAt = new Date();
    await user.save();
    await ActivityLog.create({
      organizationId: membership.organizationId,
      userId: user._id,
      action: 'auth.login',
      subjectType: 'user',
      subjectId: user.id,
      description: `${user.name} signed in`,
    });
    await SecurityEvent.create({ organizationId: membership.organizationId, userId: user._id, type: 'auth.login', success: true, ipAddress: request.ip, userAgent: request.get('user-agent'), description: `${user.name} signed in` });

    response.json({ data: { token, user: { id: user.id, name: user.name, email: user.email }, organizationId: membership.organizationId } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (request, response, next) => {
  try {
    const token = readCookie(request, 'avin_refresh');
    if (!token) throw new ApiError(401, 'Session refresh required', 'REFRESH_REQUIRED');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await RefreshSession.findOne({ tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).select('+tokenHash');
    if (!session) throw new ApiError(401, 'Session has expired', 'SESSION_EXPIRED');
    const [user, membership] = await Promise.all([User.findOne({ _id: session.userId, isActive: true }), Membership.findOne({ userId: session.userId, organizationId: session.organizationId, isActive: true })]);
    if (!user || !membership) throw new ApiError(401, 'Session is no longer active', 'SESSION_INACTIVE');
    session.revokedAt = new Date(); await session.save();
    const accessToken = await issueSession(response, request, user, membership);
    response.json({ data: { token: accessToken, user: { id: user.id, name: user.name, email: user.email } } });
  } catch (error) { next(error); }
});

authRouter.post('/logout', async (request, response, next) => {
  try {
    const token = readCookie(request, 'avin_refresh');
    if (token) await RefreshSession.findOneAndUpdate({ tokenHash: createHash('sha256').update(token).digest('hex'), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    response.clearCookie('avin_refresh', { path: '/api/v1/auth' });
    response.json({ data: { signedOut: true } });
  } catch (error) { next(error); }
});

authRouter.post('/forgot-password', async (request, response, next) => {
  try {
    const input = z.object({ email: z.string().email() }).parse(request.body);
    const user = await User.findOne({ email: input.email.toLowerCase(), isActive: true });
    let resetToken: string | undefined;
    if (user) {
      await PasswordResetToken.updateMany({ userId: user._id, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } });
      resetToken = randomBytes(32).toString('base64url');
      await PasswordResetToken.create({ userId: user._id, tokenHash: createHash('sha256').update(resetToken).digest('hex'), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
      await SecurityEvent.create({ userId: user._id, type: 'auth.password_reset.requested', success: true, ipAddress: request.ip, userAgent: request.get('user-agent'), description: 'Password reset requested' });
    }
    response.json({ data: { accepted: true, ...(env.NODE_ENV === 'development' && resetToken ? { resetToken } : {}) } });
  } catch (error) { next(error); }
});

authRouter.post('/reset-password', async (request, response, next) => {
  try {
    const input = z.object({ token: z.string().min(20), password: z.string().min(10).max(128) }).parse(request.body);
    const reset = await PasswordResetToken.findOne({ tokenHash: createHash('sha256').update(input.token).digest('hex'), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).select('+tokenHash');
    if (!reset) throw new ApiError(400, 'Reset link is invalid or expired', 'INVALID_RESET');
    await User.findByIdAndUpdate(reset.userId, { $set: { passwordHash: await bcrypt.hash(input.password, 12) } });
    reset.usedAt = new Date(); await reset.save();
    await RefreshSession.updateMany({ userId: reset.userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    await SecurityEvent.create({ userId: reset.userId, type: 'auth.password_reset.completed', success: true, ipAddress: request.ip, userAgent: request.get('user-agent'), description: 'Password reset completed and existing sessions revoked' });
    response.json({ data: { reset: true } });
  } catch (error) { next(error); }
});

authRouter.post('/accept-invitation', async (request, response, next) => {
  try {
    const input = z.object({
      token: z.string().min(20),
      password: z.string().min(8).max(128),
    }).parse(request.body);
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const invitation = await UserInvitation.findOne({
      tokenHash,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).select('+tokenHash');
    if (!invitation) throw new ApiError(404, 'Invitation is invalid or expired', 'INVALID_INVITATION');

    let user = await User.findOne({ email: invitation.email });
    if (!user) {
      user = await User.create({
        name: invitation.name,
        email: invitation.email,
        passwordHash: await bcrypt.hash(input.password, 12),
      });
    } else {
      user.passwordHash = await bcrypt.hash(input.password, 12);
      user.isActive = true;
      await user.save();
    }
    await Membership.findOneAndUpdate(
      { organizationId: invitation.organizationId, userId: user._id },
      {
        $set: {
          role: invitation.role,
          permissions: invitation.permissions,
          branchIds: invitation.branchIds,
          isActive: true,
        },
      },
      { upsert: true, new: true },
    );
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();
    await ActivityLog.create({
      organizationId: invitation.organizationId,
      userId: user._id,
      action: 'user.invitation.accepted',
      subjectType: 'user',
      subjectId: user.id,
      description: `${user.name} accepted an organization invitation`,
    });
    response.status(201).json({ data: { accepted: true, email: user.email } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/change-password', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }).parse(request.body);
    const user = await User.findById(request.auth!.userId).select('+passwordHash');
    if (!user || !(await bcrypt.compare(input.currentPassword, user.get('passwordHash') as string))) {
      throw new ApiError(400, 'Current password is incorrect', 'INCORRECT_PASSWORD');
    }
    user.passwordHash = await bcrypt.hash(input.newPassword, 12);
    await user.save();
    await ActivityLog.create({
      organizationId: request.auth!.organizationId,
      userId: user._id,
      action: 'user.password.changed',
      subjectType: 'user',
      subjectId: user.id,
      description: `${user.name} changed their password`,
    });
    response.json({ data: { changed: true } });
  } catch (error) {
    next(error);
  }
});
