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
  },
  { timestamps: true },
);
activityLogSchema.index({ organizationId: 1, createdAt: -1 });
export const ActivityLog = model("ActivityLog", activityLogSchema);
