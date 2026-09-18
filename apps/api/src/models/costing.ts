import { Schema, model } from "mongoose";
import { tenantFields } from "./base.js";

const budgetSchema = new Schema({
  ...tenantFields,
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  materialsPaise: { type: Number, default: 0, min: 0 },
  labourPaise: { type: Number, default: 0, min: 0 },
  subcontractorPaise: { type: Number, default: 0, min: 0 },
  transportPaise: { type: Number, default: 0, min: 0 },
  installationPaise: { type: Number, default: 0, min: 0 },
  sitePaise: { type: Number, default: 0, min: 0 },
  overheadPaise: { type: Number, default: 0, min: 0 },
  contingencyPaise: { type: Number, default: 0, min: 0 },
  approvalThresholdPaise: { type: Number, default: 10_000_00, min: 0 },
  status: { type: String, enum: ["draft", "submitted", "approved"], default: "draft" },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: Date,
}, { timestamps: true });
budgetSchema.index({ organizationId: 1, projectId: 1 }, { unique: true });
export const ProjectBudget = model("ProjectBudget", budgetSchema);

const projectCostSchema = new Schema({
  ...tenantFields,
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  category: { type: String, enum: ["labour", "subcontractor", "transport", "installation", "site", "general", "miscellaneous", "material_issue", "material_return"], required: true },
  description: { type: String, required: true },
  vendor: String,
  quantity: { type: Number, default: 1, min: 0 },
  unit: { type: String, default: "fixed" },
  unitRatePaise: { type: Number, default: 0, min: 0 },
  amountPaise: { type: Number, required: true, min: 1 },
  incurredAt: { type: Date, default: Date.now },
  reference: String,
  notes: String,
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: Date,
}, { timestamps: true });
projectCostSchema.index({ organizationId: 1, projectId: 1, incurredAt: -1 });
export const ProjectCost = model("ProjectCost", projectCostSchema);

const changeOrderSchema = new Schema({
  ...tenantFields,
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  changeNumber: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  revenueImpactPaise: { type: Number, default: 0, min: 0 },
  costImpactPaise: { type: Number, default: 0, min: 0 },
  reason: String,
  status: { type: String, enum: ["draft", "submitted", "approved", "rejected"], default: "draft" },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: Date,
}, { timestamps: true });
changeOrderSchema.index({ organizationId: 1, projectId: 1, changeNumber: 1 }, { unique: true });
export const ChangeOrder = model("ChangeOrder", changeOrderSchema);
