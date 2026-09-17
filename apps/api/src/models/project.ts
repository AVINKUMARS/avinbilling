import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const areaSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['building', 'floor', 'room', 'area'], required: true },
    parentLocalId: String,
    localId: { type: String, required: true },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    ...tenantFields,
    projectNumber: { type: String, required: true },
    name: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    projectType: { type: String, required: true },
    siteAddress: String,
    status: { type: String, enum: ['lead', 'survey', 'estimating', 'quoted', 'approved', 'active', 'completed', 'cancelled'], default: 'lead' },
    areas: [areaSchema],
    tags: [String],
  },
  { timestamps: true },
);
projectSchema.index({ organizationId: 1, projectNumber: 1 }, { unique: true });
export const Project = model('Project', projectSchema);
