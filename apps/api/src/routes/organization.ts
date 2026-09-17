import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { Organization } from '../models/organization.js';

const settingsInput = z.object({
  companyProfile: z.object({ legalName: z.string().min(2), tradeName: z.string().optional(), proprietorName: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), phones: z.array(z.string()).max(5), email: z.string().email().optional().or(z.literal('')), gstin: z.string().optional(), pan: z.string().optional(), bankName: z.string().optional(), accountNumber: z.string().optional(), ifsc: z.string().optional(), upiId: z.string().optional() }),
  documents: z.object({ quotationTitle: z.string().min(2), invoiceTitle: z.string().min(2), productTagline: z.string().optional(), deliveryTerms: z.string().optional(), paymentTerms: z.string().optional(), warrantyTerms: z.string().optional(), footerText: z.string().optional(), authorisedSignatory: z.string().optional(), primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), showGst: z.boolean() }),
  theme: z.object({ primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), sidebarColor: z.string().regex(/^#[0-9a-f]{6}$/i), backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i), surfaceColor: z.string().regex(/^#[0-9a-f]{6}$/i), borderRadius: z.enum(['compact', 'rounded', 'soft']), density: z.enum(['comfortable', 'compact']), fontFamily: z.enum(['system', 'modern', 'classic']) }),
});

const exampleSettings = {
  companyProfile: { legalName: 'MEERA ENTERPRISES UPVC INTERIORS', tradeName: 'MEERA ENTERPRISES', proprietorName: 'S. RAVI', address: '# 93/13, New No. 32/14, 21st Cross, Kaggadasapura', city: 'Bangalore', state: 'Karnataka', postalCode: '560093', phones: ['9901065174', '7795471996'], email: '', gstin: '29ASGPR3209Q1Z1', pan: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' },
  documents: { quotationTitle: 'QUOTATION', invoiceTitle: 'TAX INVOICE', productTagline: 'Doors, Kitchen Cabinets, Wardrobe & Loft', deliveryTerms: 'Delivery schedule will be confirmed with the approved order.', paymentTerms: 'Advance payment is required to confirm the order.', warrantyTerms: 'Warranty is subject to the approved product and material terms.', footerText: 'Thank you. We are always at your service.', authorisedSignatory: 'S. RAVI', primaryColor: '#0f766e', showGst: true },
  theme: { primaryColor: '#0f766e', sidebarColor: '#020617', backgroundColor: '#f4f7f5', surfaceColor: '#ffffff', borderRadius: 'rounded' as const, density: 'comfortable' as const, fontFamily: 'system' as const },
};

export const organizationRouter = Router();
organizationRouter.use(requireAuth);
organizationRouter.get('/settings', async (request, response, next) => { try { const organization = await Organization.findById(request.auth!.organizationId).lean(); if (!organization) { response.status(404).json({ error: { message: 'Organization not found' } }); return; } const saved = organization.settings as typeof exampleSettings | undefined; response.json({ data: { companyProfile: { ...exampleSettings.companyProfile, ...saved?.companyProfile }, documents: { ...exampleSettings.documents, ...saved?.documents }, theme: { ...exampleSettings.theme, ...saved?.theme } } }); } catch (e) { next(e); } });
organizationRouter.patch('/settings', requirePermission('settings.update'), async (request, response, next) => { try { const input = settingsInput.parse(request.body); const data = await Organization.findByIdAndUpdate(request.auth!.organizationId, { $set: { 'settings.companyProfile': input.companyProfile, 'settings.documents': input.documents, 'settings.theme': input.theme } }, { new: true }); response.json({ data }); } catch (e) { next(e); } });
