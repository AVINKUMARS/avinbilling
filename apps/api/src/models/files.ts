import { Schema, model } from 'mongoose';
import { tenantFields } from './base.js';

const attachmentSchema = new Schema({
  ...tenantFields,
  entityType: { type: String, enum: ['client', 'project', 'measurement', 'quote', 'delivery', 'installation', 'service'], required: true, index: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  category: { type: String, enum: ['document', 'site_photo', 'measurement_photo', 'delivery_proof', 'installation_proof', 'other'], default: 'document' },
  fileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  storageKey: { type: String, required: true, unique: true },
  checksum: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
attachmentSchema.index({ organizationId: 1, entityType: 1, entityId: 1, createdAt: -1 });
export const Attachment = model('Attachment', attachmentSchema);

const notificationPreferenceSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  inApp: { type: Boolean, default: true },
  email: { type: Boolean, default: false },
  whatsapp: { type: Boolean, default: false },
  paymentReminders: { type: Boolean, default: true },
  followUpReminders: { type: Boolean, default: true },
  serviceReminders: { type: Boolean, default: true },
}, { timestamps: true });
notificationPreferenceSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
export const NotificationPreference = model('NotificationPreference', notificationPreferenceSchema);

const notificationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  event: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: String,
  channels: [{ type: String, enum: ['in_app', 'email', 'whatsapp'] }],
  deliveryStatus: { type: Map, of: String },
  readAt: Date,
  scheduledFor: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
notificationSchema.index({ organizationId: 1, userId: 1, createdAt: -1 });
export const Notification = model('Notification', notificationSchema);
