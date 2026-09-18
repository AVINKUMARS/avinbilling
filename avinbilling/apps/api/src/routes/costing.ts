import { Router } from "express";
import { z } from "zod";
import { calculateProjectCosting } from "@avin/shared";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { ApiError } from "../middleware/error-handler.js";
import { Project } from "../models/project.js";
import { Quote } from "../models/quote.js";
import { PurchaseOrder } from "../models/operations.js";
import { ChangeOrder, ProjectBudget, ProjectCost } from "../models/costing.js";

export const costingRouter = Router();
costingRouter.use(requireAuth);

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const paise = z.number().int().min(0).max(10_000_000_000);
const budgetInput = z.object({
  materialsPaise: paise.default(0), labourPaise: paise.default(0), subcontractorPaise: paise.default(0),
  transportPaise: paise.default(0), installationPaise: paise.default(0), sitePaise: paise.default(0),
  overheadPaise: paise.default(0), contingencyPaise: paise.default(0), approvalThresholdPaise: paise.default(1_000_000),
});
const costCategory = z.enum(["labour", "subcontractor", "transport", "installation", "site", "general", "miscellaneous", "material_issue", "material_return"]);
const costInput = z.object({
  category: costCategory, description: z.string().trim().min(2).max(200), vendor: z.string().trim().max(120).optional(),
  quantity: z.number().positive().max(1_000_000).default(1), unit: z.string().trim().max(30).default("fixed"),
  unitRatePaise: paise.default(0), amountPaise: z.number().int().positive().max(10_000_000_000),
  incurredAt: z.coerce.date().default(() => new Date()), reference: z.string().trim().max(100).optional(), notes: z.string().trim().max(1_000).optional(),
});
const changeInput = z.object({ title: z.string().trim().min(2).max(160), description: z.string().trim().max(1_000).optional(), revenueImpactPaise: paise.default(0), costImpactPaise: paise.default(0), reason: z.string().trim().max(300).optional() });

async function ensureProject(organizationId: unknown, projectId: string) {
  const project = await Project.findOne({ _id: projectId, organizationId }).select("name projectNumber status").lean();
  if (!project) throw new ApiError(404, "Project not found", "PROJECT_NOT_FOUND");
  return project;
}

costingRouter.get("/projects/:projectId", async (request, response, next) => {
  try {
    const projectId = objectId.parse(request.params.projectId);
    const organizationId = request.auth!.organizationId;
    const project = await ensureProject(organizationId, projectId);
    const [budget, costs, changes, quotes, purchases] = await Promise.all([
      ProjectBudget.findOne({ organizationId, projectId }).lean(),
      ProjectCost.find({ organizationId, projectId }).sort({ incurredAt: -1, createdAt: -1 }).lean(),
      ChangeOrder.find({ organizationId, projectId }).sort({ createdAt: -1 }).lean(),
      Quote.find({ organizationId, projectId, status: "approved" }).select("pricingSnapshot").lean(),
      PurchaseOrder.find({ organizationId, projectId, status: { $ne: "cancelled" } }).select("totalPaise").lean(),
    ]);
    const baseRevenuePaise = quotes.reduce((sum, quote) => sum + Number((quote.pricingSnapshot as { totalPaise?: number } | undefined)?.totalPaise ?? 0), 0);
    const committedPurchasePaise = purchases.reduce((sum, purchase) => sum + Number(purchase.totalPaise ?? 0), 0);
    const budgetValues: Record<string, number> = budget ? {
      materials: budget.materialsPaise, labour: budget.labourPaise, subcontractor: budget.subcontractorPaise,
      transport: budget.transportPaise, installation: budget.installationPaise, site: budget.sitePaise,
      overhead: budget.overheadPaise, contingency: budget.contingencyPaise,
    } : {};
    const summary = calculateProjectCosting({ baseRevenuePaise, budget: budgetValues, costs: costs.map((cost) => ({ category: cost.category, amountPaise: cost.amountPaise, status: cost.status })), changes: changes.map((change) => ({ revenueImpactPaise: change.revenueImpactPaise, costImpactPaise: change.costImpactPaise, status: change.status })), committedPurchasePaise });
    response.json({ data: { project, budget, costs, changes, summary } });
  } catch (error) { next(error); }
});

costingRouter.put("/projects/:projectId/budget", requirePermission("costing.manage"), async (request, response, next) => {
  try {
    const projectId = objectId.parse(request.params.projectId);
    const organizationId = request.auth!.organizationId;
    await ensureProject(organizationId, projectId);
    const existing = await ProjectBudget.findOne({ organizationId, projectId });
    if (existing?.status === "approved") throw new ApiError(409, "Approved budgets are locked", "BUDGET_LOCKED");
    const input = budgetInput.parse(request.body);
    const data = await ProjectBudget.findOneAndUpdate({ organizationId, projectId }, { $set: { ...input, status: "draft", updatedBy: request.auth!.userId }, $setOnInsert: { createdBy: request.auth!.userId } }, { new: true, upsert: true });
    response.json({ data });
  } catch (error) { next(error); }
});

costingRouter.post("/projects/:projectId/budget/submit", requirePermission("costing.manage"), async (request, response, next) => {
  try {
    const data = await ProjectBudget.findOneAndUpdate({ organizationId: request.auth!.organizationId, projectId: objectId.parse(request.params.projectId), status: "draft" }, { $set: { status: "submitted", updatedBy: request.auth!.userId } }, { new: true });
    if (!data) throw new ApiError(409, "Save a draft budget before submitting", "BUDGET_NOT_DRAFT");
    response.json({ data });
  } catch (error) { next(error); }
});

costingRouter.post("/projects/:projectId/budget/approve", requirePermission("costing.approve"), async (request, response, next) => {
  try {
    const data = await ProjectBudget.findOneAndUpdate({ organizationId: request.auth!.organizationId, projectId: objectId.parse(request.params.projectId), status: "submitted" }, { $set: { status: "approved", approvedBy: request.auth!.userId, approvedAt: new Date(), updatedBy: request.auth!.userId } }, { new: true });
    if (!data) throw new ApiError(409, "Only submitted budgets can be approved", "BUDGET_NOT_SUBMITTED");
    response.json({ data });
  } catch (error) { next(error); }
});

costingRouter.post("/projects/:projectId/costs", requirePermission("costing.manage"), async (request, response, next) => {
  try {
    const projectId = objectId.parse(request.params.projectId);
    const organizationId = request.auth!.organizationId;
    await ensureProject(organizationId, projectId);
    const input = costInput.parse(request.body);
    const budget = await ProjectBudget.findOne({ organizationId, projectId }).lean();
    const requiresApproval = !budget || input.amountPaise >= budget.approvalThresholdPaise;
    const data = await ProjectCost.create({ ...input, organizationId, projectId, status: requiresApproval ? "pending" : "approved", approvedBy: requiresApproval ? undefined : request.auth!.userId, approvedAt: requiresApproval ? undefined : new Date(), createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

costingRouter.patch("/costs/:id/status", requirePermission("costing.approve"), async (request, response, next) => {
  try {
    const status = z.enum(["approved", "rejected"]).parse(request.body.status);
    const data = await ProjectCost.findOneAndUpdate({ _id: objectId.parse(request.params.id), organizationId: request.auth!.organizationId, status: "pending" }, { $set: { status, approvedBy: request.auth!.userId, approvedAt: new Date(), updatedBy: request.auth!.userId } }, { new: true });
    if (!data) throw new ApiError(409, "Only pending costs can be approved or rejected", "COST_NOT_PENDING");
    response.json({ data });
  } catch (error) { next(error); }
});

costingRouter.post("/projects/:projectId/changes", requirePermission("costing.manage"), async (request, response, next) => {
  try {
    const projectId = objectId.parse(request.params.projectId);
    const organizationId = request.auth!.organizationId;
    await ensureProject(organizationId, projectId);
    const input = changeInput.parse(request.body);
    const count = await ChangeOrder.countDocuments({ organizationId, projectId });
    const data = await ChangeOrder.create({ ...input, organizationId, projectId, changeNumber: `VO-${String(count + 1).padStart(4, "0")}`, status: "submitted", createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});

costingRouter.patch("/changes/:id/status", requirePermission("costing.approve"), async (request, response, next) => {
  try {
    const status = z.enum(["approved", "rejected"]).parse(request.body.status);
    const data = await ChangeOrder.findOneAndUpdate({ _id: objectId.parse(request.params.id), organizationId: request.auth!.organizationId, status: "submitted" }, { $set: { status, approvedBy: request.auth!.userId, approvedAt: new Date(), updatedBy: request.auth!.userId } }, { new: true });
    if (!data) throw new ApiError(409, "Only submitted variations can be approved or rejected", "CHANGE_NOT_SUBMITTED");
    response.json({ data });
  } catch (error) { next(error); }
});
