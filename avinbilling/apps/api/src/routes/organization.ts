import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { Organization } from '../models/organization.js';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '../middleware/error-handler.js';
import { Membership, User } from '../models/user.js';
import { ActivityLog, Branch, organizationRoles, UserInvitation } from '../models/access.js';
import { getIndustryPack, industryPackCatalog, type IndustryPackDefinition } from '@avin/industry-packs';
import { resolveModules } from '@avin/module-registry';
import { CatalogItem, RateCard } from '../models/catalog.js';
import { CustomDefinition } from '../models/operations.js';

const settingsInput = z.object({
  companyProfile: z.object({ legalName: z.string().min(2), tradeName: z.string().optional(), proprietorName: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), phones: z.array(z.string()).max(5), email: z.string().email().optional().or(z.literal('')), gstin: z.string().optional(), pan: z.string().optional(), bankName: z.string().optional(), accountNumber: z.string().optional(), ifsc: z.string().optional(), upiId: z.string().optional() }),
  documents: z.object({ quotationTitle: z.string().min(2), invoiceTitle: z.string().min(2), productTagline: z.string().optional(), deliveryTerms: z.string().optional(), paymentTerms: z.string().optional(), warrantyTerms: z.string().optional(), footerText: z.string().optional(), authorisedSignatory: z.string().optional(), primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), showGst: z.boolean() }),
  theme: z.object({ primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), sidebarColor: z.string().regex(/^#[0-9a-f]{6}$/i), backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i), surfaceColor: z.string().regex(/^#[0-9a-f]{6}$/i), borderRadius: z.enum(['compact', 'rounded', 'soft']), density: z.enum(['comfortable', 'compact']), fontFamily: z.enum(['system', 'modern', 'classic']) }),
});

const exampleSettings = {
  companyProfile: { legalName: 'MEERA ENTERPRISES UPVC INTERIORS', tradeName: 'MEERA ENTERPRISES', proprietorName: 'S. RAVI', address: '# 93/13, New No. 32/14, 21st Cross, Kaggadasapura', city: 'Bangalore', state: 'Karnataka', postalCode: '560093', phones: ['9901065174', '7795471996'], email: '', gstin: '29ASGPR3209Q1Z1', pan: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' },
  documents: { quotationTitle: 'QUOTATION', invoiceTitle: 'TAX INVOICE', productTagline: 'Doors, Kitchen Cabinets, Wardrobe & Loft', deliveryTerms: 'Delivery schedule will be confirmed with the approved order.', paymentTerms: 'Advance payment is required to confirm the order.', warrantyTerms: 'Warranty is subject to the approved product and material terms.', footerText: 'Thank you. We are always at your service.', authorisedSignatory: 'S. RAVI', primaryColor: '#0f766e', showGst: true },
  theme: { primaryColor: '#0f766e', sidebarColor: '#020617', backgroundColor: '#f4f7f5', surfaceColor: '#ffffff', borderRadius: 'rounded' as const, density: 'comfortable' as const, fontFamily: 'system' as const },
};

export const organizationRouter = Router();
organizationRouter.use(requireAuth);
organizationRouter.get('/settings', async (request, response, next) => { try { const organization = await Organization.findById(request.auth!.organizationId).lean(); if (!organization) { response.status(404).json({ error: { message: 'Organization not found' } }); return; } const saved = organization.settings as typeof exampleSettings | undefined; response.json({ data: { companyProfile: { ...exampleSettings.companyProfile, ...saved?.companyProfile }, documents: { ...exampleSettings.documents, ...saved?.documents }, theme: { ...exampleSettings.theme, ...saved?.theme } } }); } catch (e) { next(e); } });
organizationRouter.patch('/settings', requirePermission('settings.update'), async (request, response, next) => { try { const input = settingsInput.parse(request.body); const data = await Organization.findByIdAndUpdate(request.auth!.organizationId, { $set: { 'settings.companyProfile': input.companyProfile, 'settings.documents': input.documents, 'settings.theme': input.theme } }, { new: true }); response.json({ data }); } catch (e) { next(e); } });

async function seedIndustryPackExamples(
  organizationId: unknown,
  userId: unknown,
  pack: IndustryPackDefinition,
) {
  const catalogItems = [];
  for (const item of pack.seedItems) {
    const catalogItem = await CatalogItem.findOneAndUpdate(
      { organizationId, code: item.code },
      {
        $setOnInsert: {
          organizationId,
          categoryKey: item.categoryKey,
          name: item.name,
          code: item.code,
          itemType: item.itemType,
          unit: item.unit,
          attributes: { industryPackKey: pack.key, example: true },
          isActive: true,
          createdBy: userId,
          updatedBy: userId,
        },
      },
      { upsert: true, new: true },
    );
    catalogItems.push({ catalogItem, seed: item });
  }

  const rateCardName = `${pack.name} Example Rates`;
  let rateCard = await RateCard.findOne({ organizationId, name: rateCardName });
  if (!rateCard) {
    rateCard = await RateCard.create({
      organizationId,
      name: rateCardName,
      version: 1,
      customerType: 'retail',
      effectiveFrom: new Date(),
      defaultWastagePercent: 10,
      status: 'draft',
      lines: catalogItems.map(({ catalogItem, seed }) => ({
        catalogItemId: catalogItem._id,
        purchaseRatePaise: seed.purchaseRatePaise,
        sellingRatePaise: seed.sellingRatePaise,
        wastagePercent: seed.wastagePercent,
      })),
      createdBy: userId,
      updatedBy: userId,
    });
  }
  return { itemsCreatedOrFound: catalogItems.length, rateCardId: rateCard.id };
}

async function installPackDefinitions(
  organizationId: unknown,
  userId: unknown,
  pack: IndustryPackDefinition,
) {
  const definitions = [
    ...pack.measurementFields.map((field) => ({
      definitionType: 'field',
      key: `${pack.key}-${field.key}`.toLowerCase(),
      name: `${pack.name}: ${field.label}`,
      configuration: {
        entity: 'measurement',
        label: field.label,
        fieldType: field.unit === 'qty' || field.unit === 'mm' ? 'number' : 'text',
        required: field.required,
        options: [],
      },
    })),
    ...pack.formulas.map((formula) => ({
      definitionType: 'formula',
      key: `${pack.key}-${formula.key}`.toLowerCase(),
      name: `${pack.name}: ${formula.label}`,
      configuration: {
        entity: 'measurement',
        expression: formula.expression,
        variables: Array.from(new Set(formula.expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [])).filter((variable) => !['min', 'max', 'round'].includes(variable)),
        resultUnit: formula.resultUnit,
        decimalPlaces: 3,
      },
    })),
    {
      definitionType: 'workflow',
      key: `${pack.key}-workflow`,
      name: `${pack.name} Workflow`,
      configuration: {
        entity: 'project',
        stages: pack.defaultWorkflow.map((stage, index) => ({
          key: stage,
          label: stage.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          color: ['#64748b', '#0284c7', '#d97706', '#0f766e', '#16a34a'][index % 5],
          requiresApproval: stage === 'approved' || stage === 'quality-check',
        })),
      },
    },
  ];
  for (const definition of definitions) {
    await CustomDefinition.updateOne(
      {
        organizationId,
        definitionType: definition.definitionType,
        key: definition.key,
        version: 1,
      },
      {
        $setOnInsert: {
          ...definition,
          organizationId,
          version: 1,
          status: 'active',
          createdBy: userId,
          updatedBy: userId,
        },
      },
      { upsert: true },
    );
  }
  return definitions.length;
}

organizationRouter.get('/industry-packs', async (request, response, next) => {
  try {
    const organization = await Organization.findById(request.auth!.organizationId)
      .select('industryPacks enabledModules')
      .lean();
    const installed = new Map(
      (organization?.industryPacks ?? []).map((pack) => [pack.key, pack]),
    );
    response.json({
      data: industryPackCatalog.map((pack) => {
        const state = installed.get(pack.key);
        return {
          ...pack,
          installed: Boolean(state),
          enabled: state ? state.enabled !== false : false,
          installedVersion: state?.version,
          enabledAt: state?.enabledAt,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/industry-packs/:key/install', requirePermission('settings.update'), async (request, response, next) => {
  try {
    const input = z.object({ seedExamples: z.boolean().default(false) }).parse(request.body ?? {});
    const pack = getIndustryPack(String(request.params.key));
    if (!pack) throw new ApiError(404, 'Industry pack not found', 'PACK_NOT_FOUND');
    const organizationId = request.auth!.organizationId;
    const existingUpdate = await Organization.updateOne(
      { _id: organizationId, 'industryPacks.key': pack.key },
      {
        $set: {
          'industryPacks.$.version': pack.version,
          'industryPacks.$.enabledAt': new Date(),
          'industryPacks.$.enabled': true,
        },
        $addToSet: { enabledModules: { $each: resolveModules(pack.requiredModules) } },
      },
    );
    if (!existingUpdate.matchedCount) {
      await Organization.updateOne(
        { _id: organizationId },
        {
          $push: { industryPacks: { key: pack.key, version: pack.version, enabledAt: new Date(), enabled: true } },
          $addToSet: { enabledModules: { $each: resolveModules(pack.requiredModules) } },
        },
      );
    }
    const definitionsInstalled = await installPackDefinitions(
      organizationId,
      request.auth!.userId,
      pack,
    );
    const examples = input.seedExamples
      ? await seedIndustryPackExamples(organizationId, request.auth!.userId, pack)
      : undefined;
    await ActivityLog.create({
      organizationId,
      userId: request.auth!.userId,
      action: 'industry-pack.installed',
      subjectType: 'industry-pack',
      subjectId: pack.key,
      description: `Installed ${pack.name} industry pack`,
      metadata: { version: pack.version, seedExamples: input.seedExamples },
    });
    response.status(201).json({
      data: { key: pack.key, version: pack.version, definitionsInstalled, examples },
    });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/industry-packs/:key/seed', requirePermission('settings.update'), async (request, response, next) => {
  try {
    const pack = getIndustryPack(String(request.params.key));
    if (!pack) throw new ApiError(404, 'Industry pack not found', 'PACK_NOT_FOUND');
    const organization = await Organization.findOne({
      _id: request.auth!.organizationId,
      'industryPacks.key': pack.key,
    }).lean();
    if (!organization) throw new ApiError(409, 'Install the industry pack before adding examples', 'PACK_NOT_INSTALLED');
    const data = await seedIndustryPackExamples(
      request.auth!.organizationId,
      request.auth!.userId,
      pack,
    );
    response.json({ data });
  } catch (error) {
    next(error);
  }
});

organizationRouter.patch('/industry-packs/:key', requirePermission('settings.update'), async (request, response, next) => {
  try {
    const input = z.object({ enabled: z.boolean() }).parse(request.body);
    const pack = getIndustryPack(String(request.params.key));
    if (!pack) throw new ApiError(404, 'Industry pack not found', 'PACK_NOT_FOUND');
    const result = await Organization.updateOne(
      { _id: request.auth!.organizationId, 'industryPacks.key': pack.key },
      { $set: { 'industryPacks.$.enabled': input.enabled } },
    );
    if (!result.matchedCount) throw new ApiError(404, 'Industry pack is not installed', 'PACK_NOT_INSTALLED');
    await ActivityLog.create({
      organizationId: request.auth!.organizationId,
      userId: request.auth!.userId,
      action: input.enabled ? 'industry-pack.enabled' : 'industry-pack.disabled',
      subjectType: 'industry-pack',
      subjectId: pack.key,
      description: `${input.enabled ? 'Enabled' : 'Disabled'} ${pack.name} industry pack`,
    });
    response.json({ data: { key: pack.key, enabled: input.enabled } });
  } catch (error) {
    next(error);
  }
});

const permissionCatalog = [
  ['clients.create', 'Create and edit customers'],
  ['projects.create', 'Create projects and project areas'],
  ['catalog.manage', 'Manage products, brands and rate cards'],
  ['measurements.create', 'Record and edit site measurements'],
  ['quotes.create', 'Prepare and revise quotations'],
  ['quotes.approve', 'Approve quotations and record advances'],
  ['purchasing.create', 'Manage suppliers and purchase orders'],
  ['inventory.manage', 'Receive and allocate stock'],
  ['production.manage', 'Manage BOM, production and quality'],
  ['invoice.create', 'Create and issue invoices'],
  ['payment.create', 'Record payments and credit notes'],
  ['delivery.create', 'Manage deliveries and installations'],
  ['reports.view', 'View business and financial reports'],
  ['costing.manage', 'Create budgets, project costs and variations'],
  ['costing.approve', 'Approve budgets, project costs and variations'],
  ['settings.update', 'Change organization and document settings'],
  ['settings.customize', 'Manage custom builders'],
  ['users.manage', 'Manage branches, users and permissions'],
] as const;

const roleDefaults: Record<(typeof organizationRoles)[number], string[]> = {
  owner: ['*'],
  admin: ['*'],
  manager: permissionCatalog.map(([key]) => key).filter((key) => key !== 'users.manage'),
  estimator: ['clients.create', 'projects.create', 'catalog.manage', 'measurements.create', 'quotes.create', 'costing.manage', 'reports.view'],
  accounts: ['clients.create', 'invoice.create', 'payment.create', 'costing.manage', 'costing.approve', 'reports.view'],
  factory: ['inventory.manage', 'production.manage'],
  installer: ['measurements.create', 'delivery.create'],
  viewer: ['reports.view'],
};

const branchInput = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(30).optional(),
});

const accessInput = z.object({
  role: z.enum(organizationRoles),
  permissions: z.array(z.string()).max(100).optional(),
  branchIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).default([]),
});

async function logAccessActivity(input: {
  organizationId: unknown;
  userId: unknown;
  action: string;
  description: string;
  subjectType?: string;
  subjectId?: string;
}) {
  await ActivityLog.create(input);
}

organizationRouter.get('/access/options', (_request, response) => {
  response.json({
    data: {
      roles: organizationRoles.map((role) => ({
        key: role,
        label: role.charAt(0).toUpperCase() + role.slice(1),
        defaultPermissions: roleDefaults[role],
      })),
      permissions: permissionCatalog.map(([key, label]) => ({ key, label })),
    },
  });
});

organizationRouter.get('/branches', async (request, response, next) => {
  try {
    const filter = request.auth!.role === 'owner' || request.auth!.role === 'admin'
      ? { organizationId: request.auth!.organizationId }
      : { organizationId: request.auth!.organizationId, _id: { $in: request.auth!.branchIds } };
    response.json({
      data: await Branch.find(filter)
        .sort({ isActive: -1, name: 1 })
        .lean(),
    });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/branches', requirePermission('users.manage'), async (request, response, next) => {
  try {
    const input = branchInput.parse(request.body);
    const branch = await Branch.create({
      ...input,
      code: input.code.toUpperCase(),
      organizationId: request.auth!.organizationId,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });
    await logAccessActivity({
      organizationId: request.auth!.organizationId,
      userId: request.auth!.userId,
      action: 'branch.created',
      subjectType: 'branch',
      subjectId: branch.id,
      description: `Created branch ${branch.name}`,
    });
    response.status(201).json({ data: branch });
  } catch (error) {
    next(error);
  }
});

organizationRouter.patch('/branches/:id', requirePermission('users.manage'), async (request, response, next) => {
  try {
    const input = branchInput.partial().extend({ isActive: z.boolean().optional() }).parse(request.body);
    const branch = await Branch.findOneAndUpdate(
      { _id: request.params.id, organizationId: request.auth!.organizationId },
      { $set: { ...input, updatedBy: request.auth!.userId } },
      { new: true },
    );
    if (!branch) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    await logAccessActivity({
      organizationId: request.auth!.organizationId,
      userId: request.auth!.userId,
      action: 'branch.updated',
      subjectType: 'branch',
      subjectId: branch.id,
      description: `Updated branch ${branch.name}`,
    });
    response.json({ data: branch });
  } catch (error) {
    next(error);
  }
});

organizationRouter.get('/users', requirePermission('users.manage'), async (request, response, next) => {
  try {
    response.json({
      data: await Membership.find({ organizationId: request.auth!.organizationId })
        .populate('userId', 'name email isActive lastLoginAt')
        .populate('branchIds', 'name code isActive')
        .sort({ createdAt: 1 })
        .lean(),
    });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/users', requirePermission('users.manage'), async (request, response, next) => {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email(),
      password: z.string().min(8).max(128),
    }).merge(accessInput).parse(request.body);
    let user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) {
      user = await User.create({
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
      });
    }
    const existing = await Membership.findOne({
      organizationId: request.auth!.organizationId,
      userId: user._id,
    });
    if (existing) throw new ApiError(409, 'User already belongs to this organization', 'MEMBERSHIP_EXISTS');
    const membership = await Membership.create({
      organizationId: request.auth!.organizationId,
      userId: user._id,
      role: input.role,
      permissions: input.permissions ?? roleDefaults[input.role],
      branchIds: input.branchIds,
    });
    await logAccessActivity({
      organizationId: request.auth!.organizationId,
      userId: request.auth!.userId,
      action: 'user.created',
      subjectType: 'user',
      subjectId: user.id,
      description: `Added ${user.name} as ${input.role}`,
    });
    response.status(201).json({ data: membership });
  } catch (error) {
    next(error);
  }
});

organizationRouter.patch('/users/:id', requirePermission('users.manage'), async (request, response, next) => {
  try {
    const input = accessInput.partial().extend({ isActive: z.boolean().optional() }).parse(request.body);
    const membership = await Membership.findOne({
      _id: request.params.id,
      organizationId: request.auth!.organizationId,
    });
    if (!membership) throw new ApiError(404, 'User membership not found', 'MEMBERSHIP_NOT_FOUND');
    if (membership.userId.equals(request.auth!.userId) && input.isActive === false) {
      throw new ApiError(409, 'You cannot deactivate your own account', 'SELF_DEACTIVATION');
    }
    if (membership.role === 'owner' && input.role && input.role !== 'owner') {
      throw new ApiError(409, 'The organization owner role cannot be changed', 'OWNER_PROTECTED');
    }
    if (input.role) membership.role = input.role;
    if (input.permissions) membership.permissions = input.permissions;
    if (input.branchIds) membership.branchIds = input.branchIds as never;
    if (typeof input.isActive === 'boolean') membership.isActive = input.isActive;
    await membership.save();
    if (typeof input.isActive === 'boolean') {
      await User.findByIdAndUpdate(membership.userId, { $set: { isActive: input.isActive } });
    }
    await logAccessActivity({
      organizationId: request.auth!.organizationId,
      userId: request.auth!.userId,
      action: 'user.access.updated',
      subjectType: 'membership',
      subjectId: membership.id,
      description: `Updated user role, branches or account status`,
    });
    response.json({ data: membership });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/users/:id/reset-password', requirePermission('users.manage'), async (request, response, next) => {
  try {
    const input = z.object({ password: z.string().min(8).max(128) }).parse(request.body);
    const membership = await Membership.findOne({
      _id: request.params.id,
      organizationId: request.auth!.organizationId,
    });
    if (!membership) throw new ApiError(404, 'User membership not found', 'MEMBERSHIP_NOT_FOUND');
    const user = await User.findByIdAndUpdate(membership.userId, {
      $set: { passwordHash: await bcrypt.hash(input.password, 12), isActive: true },
    });
    await logAccessActivity({
      organizationId: request.auth!.organizationId,
      userId: request.auth!.userId,
      action: 'user.password.reset',
      subjectType: 'user',
      subjectId: String(membership.userId),
      description: `Reset password for ${user?.name ?? 'user'}`,
    });
    response.json({ data: { reset: true } });
  } catch (error) {
    next(error);
  }
});

organizationRouter.get('/invitations', requirePermission('users.manage'), async (request, response, next) => {
  try {
    response.json({
      data: await UserInvitation.find({ organizationId: request.auth!.organizationId })
        .select('-tokenHash')
        .populate('branchIds', 'name code')
        .sort({ createdAt: -1 })
        .lean(),
    });
  } catch (error) {
    next(error);
  }
});

organizationRouter.post('/invitations', requirePermission('users.manage'), async (request, response, next) => {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email(),
    }).merge(accessInput).parse(request.body);
    await UserInvitation.updateMany(
      { organizationId: request.auth!.organizationId, email: input.email, status: 'pending' },
      { $set: { status: 'revoked' } },
    );
    const token = randomBytes(32).toString('base64url');
    const invitation = await UserInvitation.create({
      organizationId: request.auth!.organizationId,
      name: input.name,
      email: input.email,
      role: input.role,
      permissions: input.permissions ?? roleDefaults[input.role],
      branchIds: input.branchIds,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: request.auth!.userId,
    });
    await logAccessActivity({
      organizationId: request.auth!.organizationId,
      userId: request.auth!.userId,
      action: 'user.invited',
      subjectType: 'invitation',
      subjectId: invitation.id,
      description: `Invited ${input.email} as ${input.role}`,
    });
    response.status(201).json({
      data: {
        invitation,
        token,
        acceptPath: `/accept-invitation?token=${encodeURIComponent(token)}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

organizationRouter.patch('/invitations/:id/revoke', requirePermission('users.manage'), async (request, response, next) => {
  try {
    const invitation = await UserInvitation.findOneAndUpdate(
      { _id: request.params.id, organizationId: request.auth!.organizationId, status: 'pending' },
      { $set: { status: 'revoked' } },
      { new: true },
    );
    if (!invitation) throw new ApiError(404, 'Pending invitation not found', 'INVITATION_NOT_FOUND');
    response.json({ data: invitation });
  } catch (error) {
    next(error);
  }
});

organizationRouter.get('/activity', requirePermission('users.manage'), async (request, response, next) => {
  try {
    response.json({
      data: await ActivityLog.find({ organizationId: request.auth!.organizationId })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    });
  } catch (error) {
    next(error);
  }
});
