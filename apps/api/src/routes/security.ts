import { Router } from 'express';
import { createHash } from 'node:crypto';
import { requirePermission } from '../middleware/auth.js';
import { ActivityLog, SecurityEvent } from '../models/access.js';
import { Client } from '../models/client.js';
import { Project } from '../models/project.js';
import { Quote } from '../models/quote.js';
import { MeasurementItem } from '../models/measurement.js';
import { Lead, FollowUp } from '../models/crm.js';
import { ServiceTicket, Warranty } from '../models/service.js';
import { Attachment, NotificationPreference } from '../models/files.js';
import { Bom, Delivery, Installation, Invoice, Payment, PurchaseOrder, StockItem, StockMovement, Supplier } from '../models/operations.js';

export const securityRouter = Router();

securityRouter.get('/events', requirePermission('security.view'), async (request, response, next) => {
  try {
    response.json({ data: await SecurityEvent.find({ organizationId: request.auth!.organizationId }).populate('userId', 'name email').sort({ createdAt: -1 }).limit(300).lean() });
  } catch (error) { next(error); }
});

securityRouter.get('/audit', requirePermission('security.view'), async (request, response, next) => {
  try {
    response.json({ data: await ActivityLog.find({ organizationId: request.auth!.organizationId }).populate('userId', 'name email').sort({ createdAt: -1 }).limit(500).lean() });
  } catch (error) { next(error); }
});

securityRouter.get('/audit/verify', requirePermission('security.view'), async (request, response, next) => {
  try {
    const rows = await ActivityLog.find({ organizationId: request.auth!.organizationId, recordHash: { $exists: true } }).sort({ createdAt: 1 }).lean();
    let previousHash = 'GENESIS'; let valid = true; let checked = 0;
    for (const row of rows) {
      const canonical = JSON.stringify({ previousHash, action: row.action, description: row.description, subjectType: row.subjectType, subjectId: row.subjectId, metadata: row.metadata, organizationId: String(row.organizationId), userId: String(row.userId ?? ''), occurredAt: row.occurredAt?.toISOString() });
      const expected = createHash('sha256').update(canonical).digest('hex');
      if (row.previousHash !== previousHash || row.recordHash !== expected) { valid = false; break; }
      previousHash = row.recordHash; checked += 1;
    }
    response.json({ data: { valid, checked, latestHash: previousHash } });
  } catch (error) { next(error); }
});

securityRouter.get('/export', requirePermission('security.export'), async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const filter = { organizationId };
    const [clients, projects, measurements, quotes, invoices, payments, boms, suppliers, purchaseOrders, stockItems, stockMovements, deliveries, installations, leads, followUps, warranties, serviceTickets, attachments, notificationPreferences, activity] = await Promise.all([
      Client.find(filter).lean(), Project.find(filter).lean(), MeasurementItem.find(filter).lean(), Quote.find(filter).lean(), Invoice.find(filter).lean(), Payment.find(filter).lean(), Bom.find(filter).lean(), Supplier.find(filter).lean(), PurchaseOrder.find(filter).lean(), StockItem.find(filter).lean(), StockMovement.find(filter).lean(), Delivery.find(filter).lean(), Installation.find(filter).lean(), Lead.find(filter).lean(), FollowUp.find(filter).lean(), Warranty.find(filter).lean(), ServiceTicket.find(filter).lean(), Attachment.find(filter).select('-storageKey').lean(), NotificationPreference.find(filter).lean(), ActivityLog.find(filter).lean(),
    ]);
    response.setHeader('Content-Disposition', `attachment; filename="avin-export-${new Date().toISOString().slice(0, 10)}.json"`);
    response.json({ exportedAt: new Date().toISOString(), organizationId, data: { clients, projects, measurements, quotes, invoices, payments, boms, suppliers, purchaseOrders, stockItems, stockMovements, deliveries, installations, leads, followUps, warranties, serviceTickets, attachments, notificationPreferences, activity } });
  } catch (error) { next(error); }
});
