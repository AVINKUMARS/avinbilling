import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { organizationBootstrapSchema, loginSchema } from '@avin/shared';
import { resolveModules } from '@avin/module-registry';
import type { ModuleKey } from '@avin/shared';
import { env } from '../config/env.js';
import { Membership, User } from '../models/user.js';
import { Organization } from '../models/organization.js';
import { ApiError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { ActivityLog, UserInvitation } from '../models/access.js';

export const authRouter = Router();

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
      throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const membership = await Membership.findOne({
      userId: user._id,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      isActive: true,
    });
    if (!membership) throw new ApiError(403, 'No active organization membership', 'NO_MEMBERSHIP');

    const token = jwt.sign({
      sub: user.id,
      organizationId: membership.organizationId.toString(),
      role: membership.role,
      permissions: membership.permissions,
      branchIds: membership.branchIds.map((id) => id.toString()),
    }, env.JWT_SECRET, { expiresIn: '8h' });

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

    response.json({ data: { token, user: { id: user.id, name: user.name, email: user.email }, organizationId: membership.organizationId } });
  } catch (error) {
    next(error);
  }
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
