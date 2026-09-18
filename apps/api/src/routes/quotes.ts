import { Router } from 'express';
import { z } from 'zod';
import { RateCard } from '../models/catalog.js';
import { MeasurementItem } from '../models/measurement.js';
import { Project } from '../models/project.js';
import { Quote } from '../models/quote.js';
import { requireAuth, requirePermission, tenantFilter } from '../middleware/auth.js';
import { CustomDefinition } from '../models/operations.js';

const createQuoteInput = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i),
  measurementIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1),
  rateCardId: z.string().regex(/^[a-f\d]{24}$/i),
  gstPercent: z.number().min(0).max(100).default(18),
  validDays: z.number().int().min(1).max(365).default(30),
});

function quantityFor(unit: string, item: { widthMm: number; heightMm: number; areaSqft: number; quantity: number }) {
  if (unit === 'sqft') return item.areaSqft * item.quantity;
  if (unit === 'rft') return 2 * (item.widthMm + item.heightMm) / 304.8 * item.quantity;
  if (unit === 'metre') return 2 * (item.widthMm + item.heightMm) / 1000 * item.quantity;
  if (unit === 'fixed') return 1;
  return item.quantity;
}

export const quoteRouter = Router();
quoteRouter.use(requireAuth);

quoteRouter.get('/', async (request, response, next) => {
  try {
    const data = await Quote.find(tenantFilter(request.auth!))
      .populate('projectId', 'name projectNumber siteAddress')
      .populate('clientId', 'name phone email billingAddress siteAddress gstin')
      .sort({ createdAt: -1 })
      .lean();
    response.json({ data });
  } catch (error) { next(error); }
});

quoteRouter.post('/', requirePermission('quotes.create'), async (request, response, next) => {
  try {
    const input = createQuoteInput.parse(request.body);
    const organizationId = request.auth!.organizationId;
    const filter = tenantFilter(request.auth!);
    const [project, measurements, card] = await Promise.all([
      Project.findOne({ _id: input.projectId, ...filter }).lean(),
      MeasurementItem.find({ _id: { $in: input.measurementIds }, projectId: input.projectId, ...filter }).lean(),
      RateCard.findOne({ _id: input.rateCardId, organizationId }).populate('lines.catalogItemId').lean(),
    ]);
    if (!project) { response.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } }); return; }
    if (!card || !card.lines.length) { response.status(400).json({ error: { code: 'RATE_CARD_INVALID', message: 'Rate card was not found or has no rates' } }); return; }
    if (measurements.length !== input.measurementIds.length) { response.status(400).json({ error: { code: 'MEASUREMENTS_INVALID', message: 'One or more project measurements were not found' } }); return; }

    const items = measurements.map((measurement) => {
      const rateLine = card.lines.find((line) => (line.catalogItemId as unknown as { categoryKey?: string })?.categoryKey === measurement.categoryKey) ?? card.lines[0]!;
      const product = rateLine.catalogItemId as unknown as { _id: unknown; name: string; code: string; unit: string };
      const billableQuantity = quantityFor(product.unit, measurement);
      const basePaise = Math.round(billableQuantity * rateLine.sellingRatePaise);
      const wastePercent = rateLine.wastagePercent ?? card.defaultWastagePercent ?? 0;
      const attributes = measurement.attributes as unknown as { installationChargePaise?: number; transportChargePaise?: number; extraChargePaise?: number; configurationType?: string; openingDirection?: string; color?: string; profileSystem?: string; glassType?: string; profileBrandId?: string; glassBrandId?: string; hardwareBrandId?: string } | undefined;
      const additionalChargesPaise = (attributes?.installationChargePaise ?? 0) + (attributes?.transportChargePaise ?? 0) + (attributes?.extraChargePaise ?? 0);
      const lineTotalPaise = basePaise + Math.round(basePaise * wastePercent / 100) + additionalChargesPaise;
      return {
        localId: measurement._id.toString(), areaLocalId: measurement.areaLocalId, categoryKey: measurement.categoryKey,
        name: `${measurement.location} — ${measurement.itemType}`, quantity: measurement.quantity,
        measurements: [
          { key: 'widthMm', label: 'Width', value: measurement.widthMm, unit: 'mm' },
          { key: 'heightMm', label: 'Height', value: measurement.heightMm, unit: 'mm' },
          { key: 'areaSqft', label: 'Area', value: measurement.areaSqft, unit: 'sqft' },
        ],
        attributes: { ...attributes, wastePercent, additionalChargesPaise },
        selectedMaterials: [{ catalogItemId: product._id, nameSnapshot: product.name, codeSnapshot: product.code, quantity: Number(billableQuantity.toFixed(3)), unit: product.unit, unitRatePaise: rateLine.sellingRatePaise, totalPaise: lineTotalPaise }],
        lineTotalPaise,
      };
    });
    const subtotalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
    const taxPaise = Math.round(subtotalPaise * input.gstPercent / 100);
    const totalPaise = subtotalPaise + taxPaise;
    const count = await Quote.countDocuments(tenantFilter(request.auth!));
    const workflowDefinition = await CustomDefinition.findOne({ organizationId, definitionType: 'workflow', status: 'active', 'configuration.entity': 'quote' }).sort({ version: -1 }).lean();
    const workflowStages = (workflowDefinition?.configuration as { stages?: Array<{ key: string }> } | undefined)?.stages ?? [];
    const quote = await Quote.create({
      quoteNumber: `QT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`, revision: 0,
      projectId: project._id, clientId: project.clientId, status: 'draft',
      validUntil: new Date(Date.now() + input.validDays * 86_400_000), items,
      options: [{ name: card.name, kind: 'custom', subtotalPaise, taxPaise, totalPaise }],
      pricingSnapshot: { currency: 'INR', rateCardId: card._id, rateCardName: card.name, rateCardVersion: card.version, subtotalPaise, gstPercent: input.gstPercent, taxPaise, totalPaise },
      organizationId, branchId: request.auth!.activeBranchId, createdBy: request.auth!.userId, updatedBy: request.auth!.userId,
      customWorkflow: workflowDefinition && workflowStages[0] ? { definitionKey: workflowDefinition.key, definitionVersion: workflowDefinition.version, currentStageKey: workflowStages[0].key, completed: false, history: [{ stageKey: workflowStages[0].key, changedAt: new Date(), changedBy: request.auth!.userId }] } : undefined,
    });
    response.status(201).json({ data: quote });
  } catch (error) { next(error); }
});

quoteRouter.post('/:id/revise', requirePermission('quotes.create'), async (request, response, next) => {
  try {
    const input = z.object({ discountPercent: z.number().min(0).max(100).default(0), validDays: z.number().int().min(1).max(365).default(30) }).parse(request.body);
    const organizationId = request.auth!.organizationId;
    const filter = tenantFilter(request.auth!);
    const source = await Quote.findOne({ _id: request.params.id, ...filter }).lean();
    if (!source) { response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Quotation not found' } }); return; }
    if (source.lockedAt || source.status === 'approved') { response.status(409).json({ error: { code: 'LOCKED', message: 'Approved quotations cannot be revised' } }); return; }
    const latest = await Quote.findOne({ ...filter, quoteNumber: source.quoteNumber }).sort({ revision: -1 }).lean();
    const snapshot = source.pricingSnapshot as { subtotalPaise: number; gstPercent: number; rateCardId: unknown; rateCardName: string; rateCardVersion: number };
    const discountPaise = Math.round(snapshot.subtotalPaise * input.discountPercent / 100);
    const taxablePaise = snapshot.subtotalPaise - discountPaise; const taxPaise = Math.round(taxablePaise * snapshot.gstPercent / 100); const totalPaise = taxablePaise + taxPaise;
    const { _id, createdAt, updatedAt, ...copy } = source;
    const data = await Quote.create({ ...copy, revision: (latest?.revision ?? source.revision) + 1, status: 'draft', validUntil: new Date(Date.now() + input.validDays * 86_400_000), pricingSnapshot: { ...snapshot, discountPercent: input.discountPercent, discountPaise, taxablePaise, taxPaise, totalPaise }, options: source.options.map((option) => ({ ...option, taxPaise, totalPaise })), createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    await Quote.updateMany({ ...filter, quoteNumber: source.quoteNumber, _id: { $ne: data._id }, status: 'draft' }, { $set: { status: 'revised' } });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});
