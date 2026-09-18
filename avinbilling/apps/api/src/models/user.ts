import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    locale: { type: String, default: 'en-IN' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export const User = model('User', userSchema);

const membershipSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'admin', 'manager', 'estimator', 'accounts', 'factory', 'installer', 'viewer'], default: 'viewer' },
    permissions: [{ type: String }],
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

membershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
export const Membership = model('Membership', membershipSchema);
