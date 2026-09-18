import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const leadSchema = new Schema(
  {
    ...tenantFields,
    leadNumber: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    source: { type: String, trim: true, default: 'Direct' },
    budget: { type: Number, default: 0 },
    stage: { type: String, enum: ['new', 'contacted', 'quoted', 'won', 'lost'], default: 'new' },
    lostReason: String,
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    convertedClientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    convertedProjectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    notes: String,
  },
  { timestamps: true },
);

leadSchema.index({ organizationId: 1, leadNumber: 1 }, { unique: true });
export const Lead = model('Lead', leadSchema);

const followUpSchema = new Schema(
  {
    ...tenantFields,
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    type: { type: String, enum: ['call', 'email', 'meeting', 'note'], required: true },
    description: { type: String, required: true },
    performedAt: { type: Date, default: Date.now },
    nextReminderAt: Date,
    completed: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const FollowUp = model('FollowUp', followUpSchema);
