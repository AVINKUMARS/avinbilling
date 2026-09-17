import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';

export type QuotePdfData = {
  _id?: string; quoteNumber: string; revision: number; status: string; validUntil: string;
  projectId?: { name: string; projectNumber: string; siteAddress?: string };
  clientId?: { name: string; phone: string; email?: string; billingAddress?: string; siteAddress?: string; gstin?: string };
  items: Array<{ name: string; quantity: number; lineTotalPaise: number; measurements: Array<{ key: string; label: string; value: number; unit: string }>; selectedMaterials: Array<{ nameSnapshot: string; codeSnapshot: string; quantity: number; unit: string; unitRatePaise: number }> }>;
  pricingSnapshot: { rateCardName: string; rateCardVersion: number; subtotalPaise: number; gstPercent: number; taxPaise: number; totalPaise: number };
  companySettings?: { companyProfile: { legalName: string; tradeName?: string; address?: string; city?: string; state?: string; postalCode?: string; phones: string[]; gstin?: string }; documents: { quotationTitle: string; deliveryTerms?: string; paymentTerms?: string; warrantyTerms?: string; footerText?: string; authorisedSignatory?: string } };
};

const styles = StyleSheet.create({
  page: { padding: 38, fontSize: 9, fontFamily: 'Helvetica', color: '#18201d' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#0f766e', paddingBottom: 14 },
  brand: { fontSize: 19, fontWeight: 700, color: '#0f766e' }, title: { fontSize: 15, fontWeight: 700, textAlign: 'right' }, muted: { color: '#64748b', marginTop: 3 },
  section: { marginTop: 18 }, sectionTitle: { fontSize: 10, fontWeight: 700, color: '#0f766e', marginBottom: 7, textTransform: 'uppercase' },
  two: { flexDirection: 'row', gap: 18 }, box: { flex: 1, backgroundColor: '#f4f7f5', padding: 11, borderRadius: 5 }, strong: { fontWeight: 700, marginBottom: 4 },
  tableHead: { flexDirection: 'row', backgroundColor: '#123d38', color: '#ffffff', padding: 7 }, row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 7 },
  item: { width: '38%' }, spec: { width: '25%' }, qty: { width: '9%', textAlign: 'right' }, rate: { width: '14%', textAlign: 'right' }, amount: { width: '14%', textAlign: 'right' },
  totals: { marginTop: 14, marginLeft: '58%' }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }, grand: { borderTopWidth: 1, borderTopColor: '#0f766e', marginTop: 4, paddingTop: 8, fontSize: 12, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 28, left: 38, right: 38, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, color: '#64748b', flexDirection: 'row', justifyContent: 'space-between' },
});
const money = (paise: number) => `INR ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function QuoteDocument({ quote }: { quote: QuotePdfData }) {
  const company = quote.companySettings?.companyProfile;
  const documents = quote.companySettings?.documents;
  return <Document><Page size="A4" style={styles.page}>
    <View style={styles.header}><View><Text style={styles.brand}>{company?.legalName ?? 'AVIN BUSINESS SUITE'}</Text><Text style={styles.muted}>{company?.address ?? 'Professional project estimation'}{company?.city ? `, ${company.city}` : ''}{company?.postalCode ? ` - ${company.postalCode}` : ''}</Text><Text style={styles.muted}>{company?.phones?.join(' / ') ?? ''}{company?.gstin ? ` · GSTIN: ${company.gstin}` : ''}</Text></View><View><Text style={styles.title}>{documents?.quotationTitle ?? 'QUOTATION'}</Text><Text style={styles.muted}>{quote.quoteNumber} · Revision {quote.revision}</Text><Text style={styles.muted}>Valid until {new Date(quote.validUntil).toLocaleDateString('en-IN')}</Text></View></View>
    <View style={[styles.section, styles.two]}><View style={styles.box}><Text style={styles.sectionTitle}>Prepared for</Text><Text style={styles.strong}>{quote.clientId?.name ?? 'Customer'}</Text><Text>{quote.clientId?.phone ?? ''}</Text><Text>{quote.clientId?.email ?? ''}</Text><Text>{quote.clientId?.siteAddress ?? quote.clientId?.billingAddress ?? ''}</Text></View><View style={styles.box}><Text style={styles.sectionTitle}>Project</Text><Text style={styles.strong}>{quote.projectId?.name ?? ''}</Text><Text>{quote.projectId?.projectNumber ?? ''}</Text><Text>{quote.projectId?.siteAddress ?? ''}</Text><Text style={styles.muted}>Rate: {quote.pricingSnapshot.rateCardName} v{quote.pricingSnapshot.rateCardVersion}</Text></View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Scope and pricing</Text><View style={styles.tableHead}><Text style={styles.item}>Item</Text><Text style={styles.spec}>Dimensions / Material</Text><Text style={styles.qty}>Qty</Text><Text style={styles.rate}>Rate</Text><Text style={styles.amount}>Amount</Text></View>{quote.items.map((item, index) => { const material = item.selectedMaterials[0]; const width = item.measurements.find((m) => m.key === 'widthMm'); const height = item.measurements.find((m) => m.key === 'heightMm'); return <View key={index} style={styles.row} wrap={false}><Text style={styles.item}>{item.name}</Text><Text style={styles.spec}>{width?.value} × {height?.value} mm{material ? `\n${material.nameSnapshot}` : ''}</Text><Text style={styles.qty}>{item.quantity}</Text><Text style={styles.rate}>{material ? money(material.unitRatePaise) : '—'}</Text><Text style={styles.amount}>{money(item.lineTotalPaise)}</Text></View>; })}</View>
    <View style={styles.totals}><View style={styles.totalRow}><Text>Subtotal</Text><Text>{money(quote.pricingSnapshot.subtotalPaise)}</Text></View><View style={styles.totalRow}><Text>GST {quote.pricingSnapshot.gstPercent}%</Text><Text>{money(quote.pricingSnapshot.taxPaise)}</Text></View><View style={[styles.totalRow, styles.grand]}><Text>Grand Total</Text><Text>{money(quote.pricingSnapshot.totalPaise)}</Text></View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Terms</Text><Text>{documents?.deliveryTerms ?? 'Delivery schedule will be confirmed with the approved order.'}</Text><Text>{documents?.paymentTerms ?? 'Advance payment is required to confirm the order.'}</Text><Text>{documents?.warrantyTerms ?? 'Warranty is subject to the approved product and material terms.'}</Text><Text style={styles.muted}>Authorised signatory: {documents?.authorisedSignatory ?? '—'}</Text></View>
    <View style={styles.footer}><Text>{documents?.footerText ?? 'Generated by Avin Business Suite'}</Text><Text>{quote.quoteNumber}</Text></View>
  </Page></Document>;
}

export async function downloadQuotePdf(quote: QuotePdfData) {
  const blob = await pdf(<QuoteDocument quote={quote} />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${quote.quoteNumber}.pdf`; anchor.click();
  URL.revokeObjectURL(url);
}
