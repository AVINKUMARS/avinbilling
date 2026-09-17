import { Schema, model } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    country: { type: String, default: 'IN' },
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    enabledModules: [{ type: String, required: true }],
    industryPacks: [{ key: String, version: Number, enabledAt: Date }],
    settings: {
      gstEnabled: { type: Boolean, default: true },
      financialYearStartMonth: { type: Number, default: 4 },
      defaultLanguage: { type: String, default: 'en' },
      companyProfile: {
        legalName: String, tradeName: String, proprietorName: String, address: String, city: String, state: String, postalCode: String,
        phones: [String], email: String, gstin: String, pan: String, bankName: String, accountNumber: String, ifsc: String, upiId: String,
      },
      documents: {
        quotationTitle: { type: String, default: 'QUOTATION' }, invoiceTitle: { type: String, default: 'TAX INVOICE' },
        productTagline: String, deliveryTerms: String, paymentTerms: String, warrantyTerms: String, footerText: String,
        authorisedSignatory: String, primaryColor: { type: String, default: '#0f766e' }, showGst: { type: Boolean, default: true },
      },
      theme: {
        primaryColor: { type: String, default: '#0f766e' }, sidebarColor: { type: String, default: '#020617' },
        backgroundColor: { type: String, default: '#f4f7f5' }, surfaceColor: { type: String, default: '#ffffff' },
        borderRadius: { type: String, enum: ['compact', 'rounded', 'soft'], default: 'rounded' },
        density: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
        fontFamily: { type: String, enum: ['system', 'modern', 'classic'], default: 'system' },
      },
    },
  },
  { timestamps: true },
);

export const Organization = model('Organization', organizationSchema);
