import { Schema, model } from "mongoose";

export const organizationRoles = [
  "owner",
  "admin",
  "manager",
  "estimator",
  "accounts",
  "factory",
  "installer",
  "viewer",
] as const;

const branchSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    address: String,
    phone: String,
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
branchSchema.index({ organizationId: 1, code: 1 }, { unique: true });
export const Branch = model("Branch", branchSchema);

const warehouseSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  address: String,
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
warehouseSchema.index({ organizationId: 1, branchId: 1, code: 1 }, { unique: true });
export const Warehouse = model('Warehouse', warehouseSchema);

const branchSequenceSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  key: { type: String, required: true },
  value: { type: Number, default: 0 },
}, { timestamps: true });
branchSequenceSchema.index({ organizationId: 1, branchId: 1, key: 1 }, { unique: true });
export const BranchSequence = model('BranchSequence', branchSequenceSchema);

const branchTransferSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  fromBranchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  toBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  reason: { type: String, required: true },
  movedRecords: { type: Number, default: 1 },
  transferredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
branchTransferSchema.index({ organizationId: 1, createdAt: -1 });
export const BranchTransfer = model('BranchTransfer', branchTransferSchema);

const invitationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: organizationRoles, required: true },
    permissions: [String],
    branchIds: [{ type: Schema.Types.ObjectId, ref: "Branch" }],
    tokenHash: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedAt: Date,
  },
  { timestamps: true },
);
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index({ organizationId: 1, email: 1, status: 1 });
export const UserInvitation = model("UserInvitation", invitationSchema);

const activityLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true },
    subjectType: String,
    subjectId: String,
    description: { type: String, required: true },
    metadata: Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    previousHash: String,
    recordHash: String,
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
activityLogSchema.index({ organizationId: 1, createdAt: -1 });
export const ActivityLog = model("ActivityLog", activityLogSchema);

const securityEventSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, required: true, index: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  success: { type: Boolean, default: true },
  ipAddress: String,
  userAgent: String,
  description: { type: String, required: true },
  metadata: Schema.Types.Mixed,
}, { timestamps: true });
securityEventSchema.index({ organizationId: 1, createdAt: -1 });
securityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31_536_000 });
export const SecurityEvent = model('SecurityEvent', securityEventSchema);
