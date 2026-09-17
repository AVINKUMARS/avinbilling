import { Router } from 'express';
import { z } from 'zod';
import { RateCard } from '../models/catalog.js';
import { MeasurementItem } from '../models/measurement.js';
import { requireAuth } from '../middleware/auth.js';

const comparisonInput = z.object({
  measurementIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1),
  rateCardIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(10),
  gstPercent: z.number().min(0).max(100).default(18),
});

function billableQuantity(unit: string, measurement: { widthMm: number; heightMm: number; areaSqft: number; quantity: number }) {
  if (unit === 'sqft') return measurement.areaSqft * measurement.quantity;
  if (unit === 'rft') return ((2 * (measurement.widthMm + measurement.heightMm)) / 304.8) * measurement.quantity;
  if (unit === 'metre') return ((2 * (measurement.widthMm + measurement.heightMm)) / 1000) * measurement.quantity;
  if (unit === 'fixed') return 1;
  return measurement.quantity;
}

export const calculationRouter = Router();
calculationRouter.use(requireAuth);

calculationRouter.post('/compare', async (request, response, next) => {
  try {
    const input = comparisonInput.parse(request.body);
    const organizationId = request.auth!.organizationId;
    const [measurements, cards] = await Promise.all([
      MeasurementItem.find({ _id: { $in: input.measurementIds }, organizationId }).lean(),
      RateCard.find({ _id: { $in: input.rateCardIds }, organizationId }).populate('lines.catalogItemId').lean(),
    ]);
    if (measurements.length !== input.measurementIds.length) {
      response.status(400).json({ error: { code: 'INVALID_MEASUREMENTS', message: 'One or more measurements were not found' } }); return;
    }
    if (cards.length !== input.rateCardIds.length) {
      response.status(400).json({ error: { code: 'INVALID_RATE_CARDS', message: 'One or more rate cards were not found' } }); return;
    }

    const options = cards.map((card) => {
      const lines = measurements.map((measurement) => {
        const rateLine = card.lines.find((line) => {
          const product = line.catalogItemId as unknown as { categoryKey?: string } | undefined;
          return product?.categoryKey === measurement.categoryKey;
        }) ?? card.lines[0];
        if (!rateLine) throw new Error(`Rate card ${card.name} has no rate lines`);
        const product = rateLine.catalogItemId as unknown as { _id?: unknown; name?: string; code?: string; unit?: string };
        const unit = product.unit ?? 'qty';
        const quantity = billableQuantity(unit, measurement);
        const basePaise = Math.round(quantity * rateLine.sellingRatePaise);
        const wastagePercent = rateLine.wastagePercent ?? card.defaultWastagePercent ?? 0;
        const wastagePaise = Math.round(basePaise * wastagePercent / 100);
        return {
          measurementId: measurement._id,
          itemNumber: measurement.itemNumber,
          location: measurement.location,
          productId: product._id,
          productName: product.name ?? 'Configured product',
          productCode: product.code ?? '',
          unit,
          billableQuantity: Number(quantity.toFixed(3)),
          unitRatePaise: rateLine.sellingRatePaise,
          basePaise,
          wastagePercent,
          wastagePaise,
          totalPaise: basePaise + wastagePaise,
        };
      });
      const subtotalPaise = lines.reduce((sum, line) => sum + line.totalPaise, 0);
      const taxPaise = Math.round(subtotalPaise * input.gstPercent / 100);
      return {
        rateCardId: card._id,
        name: card.name,
        version: card.version,
        customerType: card.customerType,
        lines,
        subtotalPaise,
        gstPercent: input.gstPercent,
        taxPaise,
        totalPaise: subtotalPaise + taxPaise,
      };
    }).sort((a, b) => a.totalPaise - b.totalPaise);
    response.json({ data: { options } });
  } catch (error) { next(error); }
});
