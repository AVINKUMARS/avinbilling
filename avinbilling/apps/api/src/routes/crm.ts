import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, tenantFilter } from '../middleware/auth.js';
import { Lead, FollowUp } from '../models/crm.js';
import { Client } from '../models/client.js';
import { Project } from '../models/project.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const crmRouter = Router();
crmRouter.use(requireAuth);

const leadInput = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(30),
  email: z.string().trim().email().optional().or(z.literal('')),
  source: z.string().trim().max(80).optional(),
  budget: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  assignedTo: objectId.optional(),
});

crmRouter.get('/leads', async (request, response, next) => {
  try {
    const data = await Lead.find(tenantFilter(request.auth!))
      .populate('assignedTo', 'name')
      .populate('convertedClientId', 'name')
      .populate('convertedProjectId', 'name projectNumber')
      .sort({ createdAt: -1 })
      .lean();
    response.json({ data });
  } catch (error) { next(error); }
});

crmRouter.post('/leads', requirePermission('clients.create'), async (request, response, next) => {
  try {
    const input = leadInput.parse(request.body);
    const count = await Lead.countDocuments(tenantFilter(request.auth!));
    const data = await Lead.create({
      ...input,
      ...tenantFilter(request.auth!),
      leadNumber: `LD-${String(count + 1).padStart(5, '0')}`,
      branchId: request.auth!.activeBranchId,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

crmRouter.patch('/leads/:id/stage', requirePermission('clients.create'), async (request, response, next) => {
  try {
    const input = z.object({
      stage: z.enum(['new', 'contacted', 'quoted', 'won', 'lost']),
      lostReason: z.string().max(1000).optional(),
    }).parse(request.body);
    
    const data = await Lead.findOneAndUpdate(
      { _id: objectId.parse(request.params.id), ...tenantFilter(request.auth!) },
      { 
        $set: { 
          stage: input.stage, 
          lostReason: input.stage === 'lost' ? input.lostReason : undefined,
          updatedBy: request.auth!.userId 
        } 
      },
      { new: true }
    );
    if (!data) { response.status(404).json({ error: { message: "Lead not found" } }); return; }
    response.json({ data });
  } catch (error) { next(error); }
});

crmRouter.post('/leads/:id/convert', requirePermission('clients.create'), async (request, response, next) => {
  try {
    const lead = await Lead.findOne({ _id: objectId.parse(request.params.id), ...tenantFilter(request.auth!) });
    if (!lead) { response.status(404).json({ error: { message: "Lead not found" } }); return; }
    if (lead.convertedClientId || lead.convertedProjectId) {
      response.status(400).json({ error: { message: "Lead already converted" } }); return;
    }

    // 1. Create Client
    const clientCount = await Client.countDocuments(tenantFilter(request.auth!));
    const newClient = await Client.create({
      ...tenantFilter(request.auth!),
      clientCode: `C-${String(clientCount + 1).padStart(5, '0')}`,
      branchId: request.auth!.activeBranchId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      notes: lead.notes,
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });

    // 2. Create Project
    const projectCount = await Project.countDocuments(tenantFilter(request.auth!));
    const newProject = await Project.create({
      ...tenantFilter(request.auth!),
      projectNumber: `P-${String(projectCount + 1).padStart(5, '0')}`,
      branchId: request.auth!.activeBranchId,
      name: `${lead.name} Project`,
      clientId: newClient._id,
      projectType: 'Converted Lead',
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });

    // 3. Update Lead
    lead.convertedClientId = newClient._id;
    lead.convertedProjectId = newProject._id;
    lead.stage = 'won';
    lead.updatedBy = request.auth!.userId;
    await lead.save();

    response.json({ data: lead, client: newClient, project: newProject });
  } catch (error) { next(error); }
});

const followUpInput = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note']),
  description: z.string().min(2).max(2000),
  nextReminderAt: z.coerce.date().optional(),
  completed: z.boolean().default(false),
});

crmRouter.get('/leads/:id/follow-ups', async (request, response, next) => {
  try {
    const data = await FollowUp.find({ leadId: objectId.parse(request.params.id), ...tenantFilter(request.auth!) })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
    response.json({ data });
  } catch (error) { next(error); }
});

crmRouter.post('/leads/:id/follow-ups', requirePermission('clients.create'), async (request, response, next) => {
  try {
    const input = followUpInput.parse(request.body);
    const lead = await Lead.findOne({ _id: objectId.parse(request.params.id), ...tenantFilter(request.auth!) });
    if (!lead) { response.status(404).json({ error: { message: "Lead not found" } }); return; }

    const data = await FollowUp.create({
      ...input,
      ...tenantFilter(request.auth!),
      leadId: lead._id,
      branchId: request.auth!.activeBranchId,
      createdBy: request.auth!.userId,
    });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});
