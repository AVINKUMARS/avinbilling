import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { organizationBootstrapSchema, loginSchema } from '@avin/shared';
import { resolveModules } from '@avin/module-registry';
import type { ModuleKey } from '@avin/shared';
import { env } from '../config/env.js';
import { Membership, User } from '../models/user.js';
import { Organization } from '../models/organization.js';
import { ApiError } from '../middleware/error-handler.js';

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
    if (!user || !(await bcrypt.compare(input.password, user.get('passwordHash') as string))) {
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
    }, env.JWT_SECRET, { expiresIn: '8h' });

    response.json({ data: { token, user: { id: user.id, name: user.name, email: user.email }, organizationId: membership.organizationId } });
  } catch (error) {
    next(error);
  }
});
