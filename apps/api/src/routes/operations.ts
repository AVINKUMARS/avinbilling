import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth, requirePermission, tenantFilter } from '../middleware/auth.js';
import { Quote } from "../models/quote.js";
import { Client } from "../models/client.js";
import { Project } from "../models/project.js";
import { CatalogItem, RateCard } from "../models/catalog.js";
import {
  Bom,
  CompletionCertificate,
  CreditNote,
  CustomDefinition,
  Delivery,
  GoodsReceipt,
  Installation,
  Invoice,
  Payment,
  PurchaseOrder,
  StockItem,
  StockMovement,
  Supplier,
} from "../models/operations.js";

export const operationsRouter = Router();
operationsRouter.use(requireAuth);
const objectId = z.string().regex(/^[a-f\d]{24}$/i);

operationsRouter.post(
  "/quotes/:id/approve",
  requirePermission("quotes.approve"),
  async (request, response, next) => {
    const inputSchema = z.object({
      amountPaise: z.number().int().positive(),
      paymentMethod: z.enum(["cash", "upi", "bank", "cheque", "card", "other"]),
      transactionReference: z.string().max(120).optional(),
    });
    const session = await mongoose.startSession();
    try {
      const input = inputSchema.parse(request.body);
      const organizationId = request.auth!.organizationId;
      let result: unknown;
      await session.withTransaction(async () => {
        const quote = await Quote.findOne({
          _id: request.params.id,
          organizationId,
        }).session(session);
        if (!quote) throw new Error("Quotation not found");
        if (quote.status === "approved" || quote.lockedAt)
          throw new Error("Quotation is already approved and locked");
        const totalPaise = Number(
          (quote.pricingSnapshot as { totalPaise?: number } | undefined)
            ?.totalPaise ?? 0,
        );
        if (input.amountPaise > totalPaise)
          throw new Error("Advance cannot exceed quotation total");
        const paymentCount = await Payment.countDocuments({
          organizationId,
        }).session(session);
        const [payment] = await Payment.create(
          [
            {
              organizationId,
              quoteId: quote._id,
              receiptNumber: `REC-${String(paymentCount + 1).padStart(5, "0")}`,
              amountPaise: input.amountPaise,
              paymentType: "advance",
              paymentMethod: input.paymentMethod,
              transactionReference: input.transactionReference,
              branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
              updatedBy: request.auth!.userId,
            },
          ],
          { session },
        );
        const bomCount = await Bom.countDocuments({ organizationId }).session(
          session,
        );
        const bomItems = quote.items.flatMap((item) => {
          const width = Number(
            item.measurements.find((entry) => entry.key === "widthMm")?.value ??
              0,
          );
          const height = Number(
            item.measurements.find((entry) => entry.key === "heightMm")
              ?.value ?? 0,
          );
          const attributes = item.attributes as unknown as
            { configurationType?: string; glassType?: string } | undefined;
          const sashCount = /3\s*track/i.test(
            attributes?.configurationType ?? "",
          )
            ? 3
            : /fixed/i.test(attributes?.configurationType ?? "")
              ? 1
              : 2;
          const qty = item.quantity || 1;
          const frameLength = 2 * (width + height) * qty;
          const sashLength = 2 * (width / sashCount + height) * sashCount * qty;
          const totalProfileMm = frameLength + sashLength;
          const wastePercent = 10;
          const profileWithWaste = totalProfileMm * (1 + wastePercent / 100);
          const material = item.selectedMaterials[0];
          return [
            {
              quoteItemLocalId: item.localId,
              location: item.name,
              componentName: `${material?.nameSnapshot ?? "UPVC"} frame profile`,
              componentCode: material?.codeSnapshot ?? "FRAME",
              quantity: qty * 4,
              unit: "cut",
              requiredQuantity: frameLength,
              barCount: Math.ceil(profileWithWaste / 5800),
              wastagePercent: wastePercent,
              notes: `${qty * 2} cuts × ${width} mm; ${qty * 2} cuts × ${height} mm`,
            },
            {
              quoteItemLocalId: item.localId,
              location: item.name,
              componentName: "Sash profile",
              componentCode: "SASH",
              quantity: qty * sashCount * 4,
              unit: "cut",
              requiredQuantity: sashLength,
              barCount: Math.ceil((sashLength * 1.1) / 5800),
              wastagePercent: wastePercent,
              notes: `${sashCount} sash(es) per unit`,
            },
            {
              quoteItemLocalId: item.localId,
              location: item.name,
              componentName: attributes?.glassType || "Glass pane",
              componentCode: "GLASS",
              quantity: qty * sashCount,
              unit: "pane",
              requiredQuantity: qty * sashCount,
              cutWidthMm: Math.max(1, Math.round(width / sashCount - 80)),
              cutHeightMm: Math.max(1, height - 100),
              notes:
                "Final deductions must be verified against the selected profile system.",
            },
            {
              quoteItemLocalId: item.localId,
              location: item.name,
              componentName: "Roller set",
              componentCode: "ROLLER",
              quantity: qty * sashCount * 2,
              unit: "qty",
              requiredQuantity: qty * sashCount * 2,
              notes: "Two rollers per moving sash.",
            },
            {
              quoteItemLocalId: item.localId,
              location: item.name,
              componentName: "Handle and lock set",
              componentCode: "LOCKSET",
              quantity: qty * sashCount,
              unit: "qty",
              requiredQuantity: qty * sashCount,
              notes: "Verify style and colour before issue.",
            },
          ];
        });
        const workflow = [
          "material-check",
          "cutting",
          "reinforcement",
          "welding",
          "assembly",
          "glazing",
          "quality-check",
          "ready",
        ].map((stage) => ({ stage, completed: false }));
        const qualityChecklist = [
          "Dimensions match approved quotation",
          "Profile and colour verified",
          "Weld finish inspected",
          "Glass and gasket fitted",
          "Hardware operation tested",
          "Final cleaning completed",
        ].map((label) => ({ label, completed: false }));
        const sequence = String(bomCount + 1).padStart(5, "0");
        const [bom] = await Bom.create(
          [
            {
              organizationId,
              bomNumber: `BOM-${sequence}`,
              workOrderNumber: `WO-${sequence}`,
              quoteId: quote._id,
              quoteRevision: quote.revision,
              items: bomItems,
              workflow,
              qualityChecklist,
              calculationVersion: 2,
              branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
              updatedBy: request.auth!.userId,
            },
          ],
          { session },
        );
        quote.status = "approved";
        quote.approvedAt = new Date();
        quote.lockedAt = new Date();
        quote.updatedBy = request.auth!.userId;
        await quote.save({ session });
        result = { quote, payment, bom };
      });
      response.json({ data: result });
    } catch (error) {
      next(error);
    } finally {
      await session.endSession();
    }
  },
);

operationsRouter.get("/payments", async (request, response, next) => {
  try {
    response.json({
      data: await Payment.find({ ...tenantFilter(request.auth!) })
        .populate("quoteId", "quoteNumber")
        .sort({ receivedAt: -1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/payments",
  requirePermission("quotes.approve"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          quoteId: objectId,
          amountPaise: z.number().int().positive(),
          paymentType: z
            .enum(["advance", "progress", "final", "refund"])
            .default("progress"),
          paymentMethod: z.enum([
            "cash",
            "upi",
            "bank",
            "cheque",
            "card",
            "other",
          ]),
          transactionReference: z.string().max(120).optional(),
          notes: z.string().max(500).optional(),
        })
        .parse(request.body);
      const organizationId = request.auth!.organizationId;
      const quote = await Quote.findOne({
        _id: input.quoteId,
        ...tenantFilter(request.auth!), status: "approved",
      }).lean();
      if (!quote) {
        response
          .status(400)
          .json({
            error: {
              code: "QUOTE_NOT_APPROVED",
              message: "Approved quotation required",
            },
          });
        return;
      }
      const total = Number(
        (quote.pricingSnapshot as { totalPaise?: number }).totalPaise ?? 0,
      );
      const existing = await Payment.find({
        quoteId: quote._id,
        ...tenantFilter(request.auth!), status: "recorded",
      }).lean();
      const paid = existing.reduce(
        (sum, payment) =>
          sum +
          (payment.paymentType === "refund"
            ? -payment.amountPaise
            : payment.amountPaise),
        0,
      );
      if (input.paymentType !== "refund" && paid + input.amountPaise > total) {
        response
          .status(400)
          .json({
            error: {
              code: "OVERPAYMENT",
              message: "Payment exceeds outstanding balance",
            },
          });
        return;
      }
      const count = await Payment.countDocuments({ organizationId });
      const data = await Payment.create({
        ...input,
        organizationId,
        receiptNumber: `REC-${String(count + 1).padStart(5, "0")}`,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      const nextPaid =
        paid +
        (input.paymentType === "refund"
          ? -input.amountPaise
          : input.amountPaise);
      await Invoice.updateMany(
        { quoteId: quote._id, organizationId },
        {
          $set: {
            paidPaise: nextPaid,
            balancePaise: total - nextPaid,
            status: nextPaid >= total ? "paid" : "part_paid",
            updatedBy: request.auth!.userId,
          },
        },
      );
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.get("/boms", async (request, response, next) => {
  try {
    response.json({
      data: await Bom.find({ ...tenantFilter(request.auth!) })
        .populate("quoteId", "quoteNumber")
        .sort({ createdAt: -1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.patch(
  "/boms/:id/status",
  requirePermission("production.update"),
  async (request, response, next) => {
    try {
      const status = z
        .enum([
          "preliminary",
          "released",
          "in_production",
          "quality_check",
          "ready",
          "completed",
        ])
        .parse(request.body.status);
      const order = [
        "preliminary",
        "released",
        "in_production",
        "quality_check",
        "ready",
        "completed",
      ];
      const bom = await Bom.findOne({
        _id: request.params.id,
        organizationId: request.auth!.organizationId,
      });
      if (!bom) {
        response.status(404).json({ error: { message: "BOM not found" } });
        return;
      }
      if (order.indexOf(status) > order.indexOf(bom.status) + 1) {
        response
          .status(409)
          .json({ error: { message: "Complete production stages in order" } });
        return;
      }
      if (
        status === "ready" &&
        bom.qualityChecklist.some((entry) => !entry.completed)
      ) {
        response
          .status(409)
          .json({
            error: {
              message: "Complete every quality check before marking ready",
            },
          });
        return;
      }
      bom.status = status;
      bom.updatedBy = request.auth!.userId;
      const stage = bom.workflow.find(
        (entry) =>
          entry.stage === status ||
          (status === "in_production" && entry.stage === "cutting") ||
          (status === "quality_check" && entry.stage === "quality-check"),
      );
      if (stage) {
        stage.completed = true;
        stage.completedAt = new Date();
      }
      await bom.save();
      response.json({ data: bom });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.patch(
  "/boms/:id/quality/:index",
  requirePermission("production.update"),
  async (request, response, next) => {
    try {
      const completed = z.boolean().parse(request.body.completed);
      const bom = await Bom.findOne({
        _id: request.params.id,
        organizationId: request.auth!.organizationId,
      });
      const index = Number(request.params.index);
      if (!bom || !Number.isInteger(index) || !bom.qualityChecklist[index]) {
        response
          .status(404)
          .json({ error: { message: "Quality check not found" } });
        return;
      }
      bom.qualityChecklist[index]!.completed = completed;
      bom.qualityChecklist[index]!.notes =
        typeof request.body.notes === "string"
          ? request.body.notes.slice(0, 500)
          : undefined;
      bom.updatedBy = request.auth!.userId;
      await bom.save();
      response.json({ data: bom });
    } catch (e) {
      next(e);
    }
  },
);

operationsRouter.get("/invoices", async (request, response, next) => {
  try {
    response.json({
      data: await Invoice.find({ ...tenantFilter(request.auth!) })
        .populate("quoteId", "quoteNumber")
        .sort({ createdAt: -1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/invoices",
  requirePermission("invoices.create"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          quoteId: objectId,
          taxMode: z.enum(["cgst_sgst", "igst"]).default("cgst_sgst"),
          placeOfSupply: z.string().max(100).default("Karnataka"),
          hsnSac: z.string().max(20).default("39252000"),
        })
        .parse(request.body);
      const quoteId = input.quoteId;
      const organizationId = request.auth!.organizationId;
      const quote = await Quote.findOne({
        _id: quoteId,
        ...tenantFilter(request.auth!), status: "approved",
      }).lean();
      if (!quote) {
        response
          .status(400)
          .json({
            error: {
              code: "QUOTE_NOT_APPROVED",
              message: "An approved quotation is required",
            },
          });
        return;
      }
      const client = await Client.findOne({
        _id: quote.clientId,
        organizationId,
      }).lean();
      const payments = await Payment.find({
        quoteId,
        ...tenantFilter(request.auth!), status: "recorded",
      }).lean();
      const snapshot = quote.pricingSnapshot as {
        subtotalPaise: number;
        discountPaise?: number;
        taxablePaise?: number;
        gstPercent?: number;
        taxPaise: number;
        totalPaise: number;
      };
      const paidPaise = payments.reduce(
        (sum, p) =>
          sum + (p.paymentType === "refund" ? -p.amountPaise : p.amountPaise),
        0,
      );
      const invoiceCount = await Invoice.countDocuments({ organizationId });
      const taxHalf = Math.round(snapshot.taxPaise / 2);
      const lineItems = quote.items.map((item) => ({
        ...item,
        hsnSac: input.hsnSac,
      }));
      const data = await Invoice.create({
        organizationId,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, "0")}`,
        quoteId,
        clientSnapshot: client,
        lineItems,
        taxMode: input.taxMode,
        gstPercent: snapshot.gstPercent ?? 18,
        placeOfSupply: input.placeOfSupply,
        subtotalPaise: snapshot.subtotalPaise,
        discountPaise: snapshot.discountPaise ?? 0,
        taxablePaise: snapshot.taxablePaise ?? snapshot.subtotalPaise,
        cgstPaise: input.taxMode === "cgst_sgst" ? taxHalf : 0,
        sgstPaise:
          input.taxMode === "cgst_sgst" ? snapshot.taxPaise - taxHalf : 0,
        igstPaise: input.taxMode === "igst" ? snapshot.taxPaise : 0,
        grandTotalPaise: snapshot.totalPaise,
        paidPaise,
        balancePaise: snapshot.totalPaise - paidPaise,
        status: "draft",
        dueAt: new Date(Date.now() + 15 * 86_400_000),
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.patch(
  "/invoices/:id/issue",
  requirePermission("invoices.create"),
  async (request, response, next) => {
    try {
      const data = await Invoice.findOneAndUpdate(
        {
          _id: request.params.id,
          ...tenantFilter(request.auth!), status: "draft",
        },
        {
          $set: {
            status: "issued",
            issuedAt: new Date(),
            updatedBy: request.auth!.userId,
          },
        },
        { new: true },
      );
      if (!data) {
        response
          .status(409)
          .json({ error: { message: "Only draft invoices can be issued" } });
        return;
      }
      response.json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.get("/credit-notes", async (request, response, next) => {
  try {
    response.json({
      data: await CreditNote.find({
        organizationId: request.auth!.organizationId,
      })
        .populate("invoiceId", "invoiceNumber")
        .sort({ issuedAt: -1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/credit-notes",
  requirePermission("invoices.create"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          invoiceId: objectId,
          amountPaise: z.number().int().positive(),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      const organizationId = request.auth!.organizationId;
      const invoice = await Invoice.findOne({
        _id: input.invoiceId,
        ...tenantFilter(request.auth!), status: { $ne: "cancelled" },
      });
      if (!invoice) {
        response.status(404).json({ error: { message: "Invoice not found" } });
        return;
      }
      if (
        (invoice.creditedPaise ?? 0) + input.amountPaise >
        (invoice.grandTotalPaise ?? 0)
      ) {
        response
          .status(400)
          .json({ error: { message: "Credit exceeds invoice total" } });
        return;
      }
      const count = await CreditNote.countDocuments({ organizationId });
      const data = await CreditNote.create({
        ...input,
        organizationId,
        quoteId: invoice.quoteId,
        creditNoteNumber: `CN-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      invoice.creditedPaise = (invoice.creditedPaise ?? 0) + input.amountPaise;
      invoice.balancePaise = Math.max(
        0,
        (invoice.grandTotalPaise ?? 0) -
          (invoice.paidPaise ?? 0) -
          invoice.creditedPaise,
      );
      invoice.updatedBy = request.auth!.userId;
      await invoice.save();
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);

operationsRouter.get("/suppliers", async (request, response, next) => {
  try {
    response.json({
      data: await Supplier.find({
        organizationId: request.auth!.organizationId,
        isActive: true,
      })
        .sort({ name: 1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/suppliers",
  requirePermission("purchasing.create"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          name: z.string().min(2),
          phone: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          gstin: z.string().optional(),
          address: z.string().optional(),
        })
        .parse(request.body);
      const count = await Supplier.countDocuments({
        organizationId: request.auth!.organizationId,
      });
      const data = await Supplier.create({
        ...input,
        supplierCode: `SUP-${String(count + 1).padStart(4, "0")}`,
        organizationId: request.auth!.organizationId,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.get("/purchase-orders", async (request, response, next) => {
  try {
    response.json({
      data: await PurchaseOrder.find({
        organizationId: request.auth!.organizationId,
      })
        .populate("supplierId", "name")
        .populate("projectId", "name")
        .sort({ createdAt: -1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/purchase-orders",
  requirePermission("purchasing.create"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          supplierId: objectId,
          projectId: objectId.optional().or(z.literal("")),
          expectedAt: z.coerce.date().optional(),
          items: z
            .array(
              z.object({
                catalogItemId: objectId,
                quantity: z.number().positive(),
                unitRatePaise: z.number().int().min(0),
              }),
            )
            .min(1),
        })
        .parse(request.body);
      const organizationId = request.auth!.organizationId;
      const catalog = await CatalogItem.find({
        _id: { $in: input.items.map((item) => item.catalogItemId) },
        organizationId,
      }).lean();
      if (
        catalog.length !==
        new Set(input.items.map((item) => item.catalogItemId)).size
      )
        throw new Error("One or more catalog items were not found");
      const items = input.items.map((line) => {
        const product = catalog.find(
          (entry) => entry._id.toString() === line.catalogItemId,
        )!;
        return {
          ...line,
          nameSnapshot: product.name,
          unit: product.unit,
          totalPaise: Math.round(line.quantity * line.unitRatePaise),
        };
      });
      const totalPaise = items.reduce((sum, item) => sum + item.totalPaise, 0);
      const count = await PurchaseOrder.countDocuments({ organizationId });
      const data = await PurchaseOrder.create({
        organizationId,
        poNumber: `PO-${String(count + 1).padStart(5, "0")}`,
        supplierId: input.supplierId,
        projectId: input.projectId || undefined,
        expectedAt: input.expectedAt,
        items,
        totalPaise,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.patch(
  "/purchase-orders/:id/order",
  requirePermission("purchasing.create"),
  async (request, response, next) => {
    try {
      const data = await PurchaseOrder.findOneAndUpdate(
        {
          _id: request.params.id,
          ...tenantFilter(request.auth!), status: "draft",
        },
        { $set: { status: "ordered", updatedBy: request.auth!.userId } },
        { new: true },
      );
      if (!data) {
        response
          .status(409)
          .json({
            error: { message: "Only draft purchase orders can be ordered" },
          });
        return;
      }
      response.json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.get("/inventory", async (request, response, next) => {
  try {
    response.json({
      data: await StockItem.find({
        organizationId: request.auth!.organizationId,
      })
        .populate("catalogItemId", "name code unit")
        .sort({ warehouse: 1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/inventory/adjust",
  requirePermission("inventory.adjust"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          catalogItemId: objectId,
          warehouse: z.string().default("Main"),
          change: z.number(),
          reorderLevel: z.number().min(0).default(0),
        })
        .parse(request.body);
      const data = await StockItem.findOneAndUpdate(
        {
          organizationId: request.auth!.organizationId,
          catalogItemId: input.catalogItemId,
          warehouse: input.warehouse,
        },
        {
          $inc: { onHand: input.change },
          $set: {
            reorderLevel: input.reorderLevel,
            updatedBy: request.auth!.userId,
          },
          $setOnInsert: { branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId },
        },
        { upsert: true, new: true },
      );
      response.json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.get("/goods-receipts", async (request, response, next) => {
  try {
    response.json({
      data: await GoodsReceipt.find({
        organizationId: request.auth!.organizationId,
      })
        .populate("purchaseOrderId", "poNumber")
        .sort({ receivedAt: -1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/goods-receipts",
  requirePermission("inventory.adjust"),
  async (request, response, next) => {
    const session = await mongoose.startSession();
    try {
      const input = z
        .object({
          purchaseOrderId: objectId,
          warehouse: z.string().min(1).default("Main"),
          items: z
            .array(
              z.object({
                catalogItemId: objectId,
                quantity: z.number().positive(),
                unit: z.string().min(1),
              }),
            )
            .min(1),
          supplierReference: z.string().max(100).optional(),
          notes: z.string().max(500).optional(),
        })
        .parse(request.body);
      const organizationId = request.auth!.organizationId;
      let data: unknown;
      await session.withTransaction(async () => {
        const po = await PurchaseOrder.findOne({
          _id: input.purchaseOrderId,
          ...tenantFilter(request.auth!), status: { $in: ["ordered", "part_received"] },
        }).session(session);
        if (!po) throw new Error("Ordered purchase order not found");
        const count = await GoodsReceipt.countDocuments({
          organizationId,
        }).session(session);
        const [receipt] = await GoodsReceipt.create(
          [
            {
              ...input,
              organizationId,
              receiptNumber: `GRN-${String(count + 1).padStart(5, "0")}`,
              branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
              updatedBy: request.auth!.userId,
            },
          ],
          { session },
        );
        for (const item of input.items) {
          await StockItem.findOneAndUpdate(
            {
              organizationId,
              catalogItemId: item.catalogItemId,
              warehouse: input.warehouse,
            },
            {
              $inc: { onHand: item.quantity },
              $set: { unit: item.unit, updatedBy: request.auth!.userId },
              $setOnInsert: { branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId },
            },
            { upsert: true, new: true, session },
          );
          const movementCount = await StockMovement.countDocuments({
            organizationId,
          }).session(session);
          await StockMovement.create(
            [
              {
                organizationId,
                movementNumber: `MOV-${String(movementCount + 1).padStart(6, "0")}`,
                catalogItemId: item.catalogItemId,
                purchaseOrderId: po._id,
                type: "receipt",
                toWarehouse: input.warehouse,
                quantity: item.quantity,
                unit: item.unit,
                reference: receipt!.receiptNumber,
                branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
                updatedBy: request.auth!.userId,
              },
            ],
            { session },
          );
        }
        po.status = "received";
        po.updatedBy = request.auth!.userId;
        await po.save({ session });
        data = receipt!;
      });
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    } finally {
      await session.endSession();
    }
  },
);
operationsRouter.get("/stock-movements", async (request, response, next) => {
  try {
    response.json({
      data: await StockMovement.find({
        organizationId: request.auth!.organizationId,
      })
        .populate("catalogItemId", "name code unit")
        .populate("projectId", "name")
        .sort({ occurredAt: -1 })
        .limit(200)
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/inventory/transfer",
  requirePermission("inventory.adjust"),
  async (request, response, next) => {
    const session = await mongoose.startSession();
    try {
      const input = z
        .object({
          catalogItemId: objectId,
          fromWarehouse: z.string().min(1),
          toWarehouse: z.string().min(1),
          quantity: z.number().positive(),
          unit: z.string().min(1),
        })
        .parse(request.body);
      const organizationId = request.auth!.organizationId;
      await session.withTransaction(async () => {
        const source = await StockItem.findOne({
          organizationId,
          catalogItemId: input.catalogItemId,
          warehouse: input.fromWarehouse,
        }).session(session);
        if (!source || source.onHand - source.allocated < input.quantity)
          throw new Error("Insufficient available stock");
        source.onHand -= input.quantity;
        await source.save({ session });
        await StockItem.findOneAndUpdate(
          {
            organizationId,
            catalogItemId: input.catalogItemId,
            warehouse: input.toWarehouse,
          },
          {
            $inc: { onHand: input.quantity },
            $set: { unit: input.unit, updatedBy: request.auth!.userId },
            $setOnInsert: { branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId },
          },
          { upsert: true, session },
        );
        const count = await StockMovement.countDocuments({
          organizationId,
        }).session(session);
        await StockMovement.create(
          [
            {
              ...input,
              organizationId,
              movementNumber: `MOV-${String(count + 1).padStart(6, "0")}`,
              type: "transfer",
              branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
              updatedBy: request.auth!.userId,
            },
          ],
          { session },
        );
      });
      response.json({ data: { transferred: true } });
    } catch (e) {
      next(e);
    } finally {
      await session.endSession();
    }
  },
);
operationsRouter.post(
  "/inventory/allocate",
  requirePermission("inventory.adjust"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          catalogItemId: objectId,
          projectId: objectId,
          warehouse: z.string().min(1).default("Main"),
          quantity: z.number().positive(),
          unit: z.string().min(1),
        })
        .parse(request.body);
      const organizationId = request.auth!.organizationId;
      const stock = await StockItem.findOne({
        organizationId,
        catalogItemId: input.catalogItemId,
        warehouse: input.warehouse,
      });
      if (!stock || stock.onHand - stock.allocated < input.quantity)
        throw new Error("Insufficient available stock");
      stock.allocated += input.quantity;
      await stock.save();
      const count = await StockMovement.countDocuments({ organizationId });
      const data = await StockMovement.create({
        ...input,
        organizationId,
        movementNumber: `MOV-${String(count + 1).padStart(6, "0")}`,
        type: "allocation",
        fromWarehouse: input.warehouse,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);

operationsRouter.get("/deliveries", async (request, response, next) => {
  try {
    response.json({
      data: await Delivery.find({
        organizationId: request.auth!.organizationId,
      })
        .populate("projectId", "name projectNumber")
        .sort({ scheduledAt: 1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/deliveries",
  requirePermission("delivery.create"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          projectId: objectId,
          scheduledAt: z.coerce.date(),
          vehicle: z.string().optional(),
          driver: z.string().optional(),
          notes: z.string().optional(),
        })
        .parse(request.body);
      const count = await Delivery.countDocuments({
        organizationId: request.auth!.organizationId,
      });
      const data = await Delivery.create({
        ...input,
        deliveryNumber: `DEL-${String(count + 1).padStart(5, "0")}`,
        packingChecklist: ["Frames labelled", "Glass protected", "Hardware packed", "Documents included"].map((label) => ({ label, completed: false })),
        organizationId: request.auth!.organizationId,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.patch("/deliveries/:id/status", requirePermission("delivery.create"), async (request, response, next) => { try { const status = z.enum(["planned", "packed", "dispatched", "delivered"]).parse(request.body.status); const order = ["planned", "packed", "dispatched", "delivered"]; const delivery = await Delivery.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId }); if (!delivery) { response.status(404).json({ error: { message: "Delivery not found" } }); return; } if (order.indexOf(status) > order.indexOf(delivery.status) + 1) { response.status(409).json({ error: { message: "Complete delivery stages in order" } }); return; } if (status === "packed" && delivery.packingChecklist.some((entry) => !entry.completed)) { response.status(409).json({ error: { message: "Complete the packing checklist first" } }); return; } delivery.status = status; if (status === "dispatched") delivery.dispatchedAt = new Date(); if (status === "delivered") delivery.deliveredAt = new Date(); await delivery.save(); response.json({ data: delivery }); } catch (e) { next(e); } });
operationsRouter.patch("/deliveries/:id/checklist/:index", requirePermission("delivery.create"), async (request, response, next) => { try { const delivery = await Delivery.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId }); const index = Number(request.params.index); if (!delivery || !delivery.packingChecklist[index]) { response.status(404).json({ error: { message: "Checklist item not found" } }); return; } delivery.packingChecklist[index]!.completed = z.boolean().parse(request.body.completed); await delivery.save(); response.json({ data: delivery }); } catch (e) { next(e); } });
operationsRouter.get("/installations", async (request, response, next) => {
  try {
    response.json({
      data: await Installation.find({
        organizationId: request.auth!.organizationId,
      })
        .populate("projectId", "name projectNumber")
        .sort({ scheduledAt: 1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/installations",
  requirePermission("installation.create"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          projectId: objectId,
          scheduledAt: z.coerce.date(),
          assignedTeam: z.string().min(1),
          notes: z.string().optional(),
        })
        .parse(request.body);
      const count = await Installation.countDocuments({
        organizationId: request.auth!.organizationId,
      });
      const data = await Installation.create({
        ...input,
        installationNumber: `INS-${String(count + 1).padStart(5, "0")}`,
        checklist: [
          { label: "Site ready", completed: false },
          { label: "Items verified", completed: false },
          { label: "Frames fixed and aligned", completed: false },
          { label: "Glass and hardware tested", completed: false },
          { label: "Sealant and cleaning completed", completed: false },
          { label: "Customer sign-off", completed: false },
        ],
        organizationId: request.auth!.organizationId,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);
operationsRouter.patch("/installations/:id/status", requirePermission("installation.create"), async (request, response, next) => { try { const status = z.enum(["planned", "in_progress", "snag", "completed"]).parse(request.body.status); const installation = await Installation.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId }); if (!installation) { response.status(404).json({ error: { message: "Installation not found" } }); return; } if (status === "completed" && (installation.checklist.some((entry) => !entry.completed) || !installation.customerSignature)) { response.status(409).json({ error: { message: "Complete the checklist and customer sign-off first" } }); return; } installation.status = status; if (status === "completed") installation.completedAt = new Date(); await installation.save(); response.json({ data: installation }); } catch (e) { next(e); } });
operationsRouter.patch("/installations/:id/checklist/:index", requirePermission("installation.create"), async (request, response, next) => { try { const installation = await Installation.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId }); const index = Number(request.params.index); if (!installation || !installation.checklist[index]) { response.status(404).json({ error: { message: "Checklist item not found" } }); return; } installation.checklist[index]!.completed = z.boolean().parse(request.body.completed); installation.checklist[index]!.notes = typeof request.body.notes === "string" ? request.body.notes.slice(0, 500) : undefined; await installation.save(); response.json({ data: installation }); } catch (e) { next(e); } });
operationsRouter.post("/installations/:id/snags", requirePermission("installation.create"), async (request, response, next) => { try { const description = z.string().trim().min(3).max(500).parse(request.body.description); const data = await Installation.findOneAndUpdate({ _id: request.params.id, organizationId: request.auth!.organizationId }, { $push: { snagItems: { description, resolved: false } }, $set: { status: "snag", updatedBy: request.auth!.userId } }, { new: true }); response.status(201).json({ data }); } catch (e) { next(e); } });
operationsRouter.post("/installations/:id/sign-off", requirePermission("installation.create"), async (request, response, next) => { try { const input = z.object({ customerSignatory: z.string().trim().min(2), signature: z.string().min(2).max(20_000) }).parse(request.body); const organizationId = request.auth!.organizationId; const installation = await Installation.findOne({ _id: request.params.id, organizationId }); if (!installation) { response.status(404).json({ error: { message: "Installation not found" } }); return; } installation.customerSignatory = input.customerSignatory; installation.customerSignature = input.signature; installation.signedAt = new Date(); const signoff = installation.checklist.find((entry) => entry.label === "Customer sign-off"); if (signoff) signoff.completed = true; await installation.save(); const count = await CompletionCertificate.countDocuments({ organizationId }); const certificate = await CompletionCertificate.create({ organizationId, certificateNumber: `CC-${String(count + 1).padStart(5, "0")}`, installationId: installation._id, projectId: installation.projectId, customerSignatory: input.customerSignatory, completedAt: new Date(), statement: "Installation work inspected and accepted by the customer.", branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId, updatedBy: request.auth!.userId }); response.status(201).json({ data: { installation, certificate } }); } catch (e) { next(e); } });
operationsRouter.get("/completion-certificates", async (request, response, next) => { try { response.json({ data: await CompletionCertificate.find({ ...tenantFilter(request.auth!) }).populate("projectId", "name projectNumber").sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); } });

function reportDateRange(fromValue: unknown, toValue: unknown) {
  const from =
    typeof fromValue === "string" && !Number.isNaN(Date.parse(fromValue))
      ? new Date(`${fromValue}T00:00:00.000Z`)
      : new Date(new Date().getUTCFullYear(), 0, 1);
  const to =
    typeof toValue === "string" && !Number.isNaN(Date.parse(toValue))
      ? new Date(`${toValue}T23:59:59.999Z`)
      : new Date();
  return { from, to };
}

operationsRouter.get("/reports/overview", async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const { from, to } = reportDateRange(request.query.from, request.query.to);
    const createdAt = { $gte: from, $lte: to };
    const [quotes, approved, revenue, paid, purchase, lowStock, invoices] =
      await Promise.all([
        Quote.countDocuments({ organizationId, createdAt }),
        Quote.countDocuments({ ...tenantFilter(request.auth!), status: "approved", createdAt }),
        Quote.aggregate([
          { $match: { ...tenantFilter(request.auth!), status: "approved", createdAt } },
          {
            $group: {
              _id: null,
              total: { $sum: "$pricingSnapshot.totalPaise" },
            },
          },
        ]),
        Payment.aggregate([
          { $match: { ...tenantFilter(request.auth!), status: "recorded", receivedAt: createdAt } },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $cond: [
                    { $eq: ["$paymentType", "refund"] },
                    { $multiply: ["$amountPaise", -1] },
                    "$amountPaise",
                  ],
                },
              },
            },
          },
        ]),
        PurchaseOrder.aggregate([
          { $match: { organizationId, createdAt, status: { $ne: "cancelled" } } },
          { $group: { _id: null, total: { $sum: "$totalPaise" } } },
        ]),
        StockItem.countDocuments({
          organizationId,
          $expr: { $lte: ["$onHand", "$reorderLevel"] },
        }),
        Invoice.aggregate([
          { $match: { organizationId, createdAt, status: { $ne: "cancelled" } } },
          {
            $group: {
              _id: null,
              total: { $sum: "$grandTotalPaise" },
              outstanding: { $sum: "$balancePaise" },
            },
          },
        ]),
      ]);
    response.json({
      data: {
        quotes,
        approved,
        approvedRevenuePaise: revenue[0]?.total ?? 0,
        paymentsPaise: paid[0]?.total ?? 0,
        purchasesPaise: purchase[0]?.total ?? 0,
        lowStock,
        invoiceValuePaise: invoices[0]?.total ?? 0,
        outstandingPaise: invoices[0]?.outstanding ?? 0,
        conversionPercent: quotes ? Math.round((approved / quotes) * 1000) / 10 : 0,
      },
    });
  } catch (e) {
    next(e);
  }
});

operationsRouter.get("/reports/projects", async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const { from, to } = reportDateRange(request.query.from, request.query.to);
    const createdAt = { $gte: from, $lte: to };
    const [projects, quotes, purchases, payments] = await Promise.all([
      Project.find({ organizationId })
        .select("name projectNumber status")
        .sort({ createdAt: -1 })
        .lean(),
      Quote.find({ ...tenantFilter(request.auth!), status: "approved", createdAt })
        .select("projectId pricingSnapshot")
        .lean(),
      PurchaseOrder.find({
        organizationId,
        createdAt,
        status: { $ne: "cancelled" },
      })
        .select("projectId totalPaise")
        .lean(),
      Payment.find({ ...tenantFilter(request.auth!), status: "recorded", receivedAt: createdAt })
        .select("quoteId amountPaise paymentType")
        .lean(),
    ]);
    const paymentQuotes = await Quote.find({
      organizationId,
      _id: { $in: payments.map((payment) => payment.quoteId) },
    })
      .select("projectId")
      .lean();
    const quoteProject = new Map<string, string>();
    for (const quote of paymentQuotes) {
      quoteProject.set(String(quote._id), String(quote.projectId));
    }
    const revenue = new Map<string, number>();
    for (const quote of quotes) {
      const projectId = String(quote.projectId);
      quoteProject.set(String(quote._id), projectId);
      const total = Number(
        (quote.pricingSnapshot as { totalPaise?: number } | undefined)?.totalPaise ?? 0,
      );
      revenue.set(projectId, (revenue.get(projectId) ?? 0) + total);
    }
    const purchaseValue = new Map<string, number>();
    for (const purchase of purchases) {
      if (!purchase.projectId) continue;
      const projectId = String(purchase.projectId);
      purchaseValue.set(
        projectId,
        (purchaseValue.get(projectId) ?? 0) + Number(purchase.totalPaise ?? 0),
      );
    }
    const collected = new Map<string, number>();
    for (const payment of payments) {
      const projectId = quoteProject.get(String(payment.quoteId));
      if (!projectId) continue;
      const signedAmount =
        payment.paymentType === "refund"
          ? -Number(payment.amountPaise)
          : Number(payment.amountPaise);
      collected.set(projectId, (collected.get(projectId) ?? 0) + signedAmount);
    }
    const data = projects
      .map((project) => {
        const projectId = String(project._id);
        const revenuePaise = revenue.get(projectId) ?? 0;
        const purchasePaise = purchaseValue.get(projectId) ?? 0;
        const collectedPaise = collected.get(projectId) ?? 0;
        return {
          projectId,
          projectNumber: project.projectNumber,
          name: project.name,
          status: project.status,
          revenuePaise,
          purchasePaise,
          collectedPaise,
          outstandingPaise: Math.max(revenuePaise - collectedPaise, 0),
          grossProfitPaise: revenuePaise - purchasePaise,
          grossMarginPercent: revenuePaise
            ? Math.round(((revenuePaise - purchasePaise) / revenuePaise) * 1000) / 10
            : 0,
        };
      })
      .filter(
        (project) =>
          project.revenuePaise ||
          project.purchasePaise ||
          project.collectedPaise,
      );
    response.json({ data });
  } catch (e) {
    next(e);
  }
});

operationsRouter.get("/reports/gst", async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const { from, to } = reportDateRange(request.query.from, request.query.to);
    const result = await Invoice.aggregate([
      {
        $match: {
          ...tenantFilter(request.auth!), status: { $ne: "cancelled" },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          taxablePaise: { $sum: "$taxablePaise" },
          cgstPaise: { $sum: "$cgstPaise" },
          sgstPaise: { $sum: "$sgstPaise" },
          igstPaise: { $sum: "$igstPaise" },
          grandTotalPaise: { $sum: "$grandTotalPaise" },
        },
      },
    ]);
    response.json({
      data: result[0] ?? {
        invoiceCount: 0,
        taxablePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        grandTotalPaise: 0,
      },
    });
  } catch (e) {
    next(e);
  }
});

operationsRouter.get("/reports/inventory", async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const [stock, rateCard] = await Promise.all([
      StockItem.find({ organizationId })
        .populate("catalogItemId", "name code")
        .sort({ warehouse: 1 })
        .lean(),
      RateCard.findOne({ organizationId })
        .sort({ effectiveFrom: -1 })
        .lean(),
    ]);
    const rates = new Map(
      (rateCard?.lines ?? []).map((line) => [
        String(line.catalogItemId),
        Number(line.purchaseRatePaise ?? 0),
      ]),
    );
    response.json({
      data: stock.map((item) => {
        const product = item.catalogItemId as unknown as {
          _id: mongoose.Types.ObjectId;
          name?: string;
          code?: string;
        };
        const ratePaise = rates.get(String(product?._id)) ?? 0;
        const available = Number(item.onHand) - Number(item.allocated);
        return {
          stockItemId: String(item._id),
          name: product?.name ?? "Catalog item",
          code: product?.code ?? "",
          warehouse: item.warehouse,
          unit: item.unit,
          onHand: item.onHand,
          allocated: item.allocated,
          available,
          reorderLevel: item.reorderLevel,
          lowStock: available <= Number(item.reorderLevel),
          ratePaise,
          valuePaise: Math.round(Number(item.onHand) * ratePaise),
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});

operationsRouter.get("/reports/wastage", async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const { from, to } = reportDateRange(request.query.from, request.query.to);
    const boms = await Bom.find({
      organizationId,
      createdAt: { $gte: from, $lte: to },
    })
      .select("items")
      .lean();
    let requiredProfileMm = 0;
    let purchasedProfileMm = 0;
    let profileBars = 0;
    let wastePercentTotal = 0;
    let wasteLines = 0;
    for (const bom of boms) {
      for (const item of bom.items) {
        const bars = Number(item.barCount ?? 0);
        if (!bars) continue;
        profileBars += bars;
        requiredProfileMm += Number(item.requiredQuantity ?? 0);
        purchasedProfileMm += bars * 5800;
        wastePercentTotal += Number(item.wastagePercent ?? 0);
        wasteLines += 1;
      }
    }
    response.json({
      data: {
        bomCount: boms.length,
        profileBars,
        requiredProfileMm,
        purchasedProfileMm,
        estimatedOffcutMm: Math.max(purchasedProfileMm - requiredProfileMm, 0),
        averageWastePercent: wasteLines
          ? Math.round((wastePercentTotal / wasteLines) * 10) / 10
          : 0,
      },
    });
  } catch (e) {
    next(e);
  }
});

operationsRouter.get("/reports/logistics", async (request, response, next) => {
  try {
    const organizationId = request.auth!.organizationId;
    const { from, to } = reportDateRange(request.query.from, request.query.to);
    const createdAt = { $gte: from, $lte: to };
    const [deliveries, installations] = await Promise.all([
      Delivery.find({ organizationId, createdAt })
        .select("status scheduledAt deliveredAt")
        .lean(),
      Installation.find({ organizationId, createdAt })
        .select("status scheduledAt completedAt snagItems")
        .lean(),
    ]);
    const delivered = deliveries.filter((item) => item.status === "delivered");
    const completed = installations.filter((item) => item.status === "completed");
    response.json({
      data: {
        deliveries: deliveries.length,
        delivered: delivered.length,
        onTimeDeliveries: delivered.filter(
          (item) =>
            item.deliveredAt &&
            item.scheduledAt &&
            item.deliveredAt.getTime() <= item.scheduledAt.getTime(),
        ).length,
        installations: installations.length,
        completedInstallations: completed.length,
        openSnags: installations.reduce(
          (total, item) =>
            total + item.snagItems.filter((snag) => !snag.resolved).length,
          0,
        ),
      },
    });
  } catch (e) {
    next(e);
  }
});
const definitionTypeSchema = z.enum([
  "field",
  "form",
  "workflow",
  "formula",
  "document",
]);

const customConfigurationSchemas = {
  field: z.object({
    entity: z.enum(["client", "project", "measurement", "quote", "invoice"]),
    label: z.string().trim().min(2).max(100),
    fieldType: z.enum(["text", "number", "date", "select", "checkbox", "textarea"]),
    required: z.boolean().default(false),
    placeholder: z.string().max(150).optional(),
    options: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  }),
  form: z.object({
    entity: z.enum(["client", "project", "measurement", "quote", "invoice"]),
    description: z.string().max(300).optional(),
    columns: z.number().int().min(1).max(3).default(1),
    fields: z.array(z.object({
      key: z.string().regex(/^[a-z][a-z0-9_-]*$/),
      label: z.string().min(2),
      fieldType: z.enum(["text", "number", "date", "select", "checkbox", "textarea"]),
      required: z.boolean().default(false),
    })).min(1).max(50),
  }),
  workflow: z.object({
    entity: z.enum(["project", "quote", "purchase", "production", "delivery", "installation", "service"]),
    stages: z.array(z.object({
      key: z.string().regex(/^[a-z][a-z0-9_-]*$/),
      label: z.string().min(2),
      color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#0f766e"),
      requiresApproval: z.boolean().default(false),
    })).min(2).max(30),
  }),
  formula: z.object({
    entity: z.enum(["measurement", "quote", "invoice", "project"]),
    expression: z.string().trim().min(1).max(500).regex(/^[0-9a-zA-Z_+\-*/().,%\s]+$/, "Formula contains unsupported characters"),
    variables: z.array(z.string().regex(/^[a-z][a-zA-Z0-9_]*$/)).max(30),
    resultUnit: z.string().trim().max(20).default("number"),
    decimalPlaces: z.number().int().min(0).max(4).default(2),
  }),
  document: z.object({
    documentType: z.enum(["quotation", "invoice", "delivery-note", "work-order", "completion-certificate"]),
    title: z.string().trim().min(2).max(100),
    blocks: z.array(z.enum(["company", "customer", "project", "items", "tax", "terms", "signature", "payment", "notes"])).min(1),
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    footer: z.string().max(300).optional(),
    showLogo: z.boolean().default(true),
  }),
} as const;

function parseCustomConfiguration(
  definitionType: z.infer<typeof definitionTypeSchema>,
  configuration: unknown,
) {
  return customConfigurationSchemas[definitionType].parse(configuration);
}

operationsRouter.get("/custom-definitions", async (request, response, next) => {
  try {
    const definitionType = request.query.type
      ? definitionTypeSchema.parse(request.query.type)
      : undefined;
    const status = request.query.status
      ? z.enum(["draft", "active", "archived"]).parse(request.query.status)
      : undefined;
    response.json({
      data: await CustomDefinition.find({
        organizationId: request.auth!.organizationId,
        ...(definitionType ? { definitionType } : {}),
        ...(status ? { status } : {}),
      })
        .sort({ updatedAt: -1, version: -1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
operationsRouter.post(
  "/custom-definitions",
  requirePermission("settings.customize"),
  async (request, response, next) => {
    try {
      const input = z
        .object({
          definitionType: definitionTypeSchema,
          key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]*$/).min(2).max(80),
          name: z.string().trim().min(2).max(120),
          configuration: z.unknown(),
        })
        .parse(request.body);
      const configuration = parseCustomConfiguration(
        input.definitionType,
        input.configuration,
      );
      const previous = await CustomDefinition.findOne({
        organizationId: request.auth!.organizationId,
        definitionType: input.definitionType,
        key: input.key,
      })
        .sort({ version: -1 })
        .lean();
      const data = await CustomDefinition.create({
        ...input,
        configuration,
        version: (previous?.version ?? 0) + 1,
        organizationId: request.auth!.organizationId,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      response.status(201).json({ data });
    } catch (e) {
      next(e);
    }
  },
);

operationsRouter.patch(
  "/custom-definitions/:id",
  requirePermission("settings.customize"),
  async (request, response, next) => {
    try {
      const definition = await CustomDefinition.findOne({
        _id: request.params.id,
        organizationId: request.auth!.organizationId,
      });
      if (!definition) {
        response.status(404).json({ error: { message: "Custom definition not found" } });
        return;
      }
      if (definition.status !== "draft") {
        response.status(409).json({ error: { message: "Only draft definitions can be edited. Create a new version instead." } });
        return;
      }
      const input = z.object({
        name: z.string().trim().min(2).max(120),
        configuration: z.unknown(),
      }).parse(request.body);
      definition.name = input.name;
      definition.configuration = parseCustomConfiguration(
        definition.definitionType as z.infer<typeof definitionTypeSchema>,
        input.configuration,
      );
      definition.updatedBy = request.auth!.userId;
      await definition.save();
      response.json({ data: definition });
    } catch (error) {
      next(error);
    }
  },
);

operationsRouter.post(
  "/custom-definitions/:id/duplicate",
  requirePermission("settings.customize"),
  async (request, response, next) => {
    try {
      const source = await CustomDefinition.findOne({
        _id: request.params.id,
        organizationId: request.auth!.organizationId,
      }).lean();
      if (!source) {
        response.status(404).json({ error: { message: "Custom definition not found" } });
        return;
      }
      const latest = await CustomDefinition.findOne({
        organizationId: request.auth!.organizationId,
        definitionType: source.definitionType,
        key: source.key,
      }).sort({ version: -1 }).lean();
      const data = await CustomDefinition.create({
        organizationId: request.auth!.organizationId,
        definitionType: source.definitionType,
        key: source.key,
        name: source.name,
        version: (latest?.version ?? 0) + 1,
        status: "draft",
        configuration: source.configuration,
        branchId: request.auth!.activeBranchId,
        createdBy: request.auth!.userId,
        updatedBy: request.auth!.userId,
      });
      response.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

operationsRouter.post(
  "/custom-definitions/:id/activate",
  requirePermission("settings.customize"),
  async (request, response, next) => {
    try {
      const definition = await CustomDefinition.findOne({
        _id: request.params.id,
        organizationId: request.auth!.organizationId,
      });
      if (!definition) {
        response.status(404).json({ error: { message: "Custom definition not found" } });
        return;
      }
      parseCustomConfiguration(
        definition.definitionType as z.infer<typeof definitionTypeSchema>,
        definition.configuration,
      );
      await CustomDefinition.updateMany(
        {
          organizationId: request.auth!.organizationId,
          definitionType: definition.definitionType,
          key: definition.key,
          status: "active",
          _id: { $ne: definition._id },
        },
        { $set: { status: "archived", updatedBy: request.auth!.userId } },
      );
      definition.status = "active";
      definition.updatedBy = request.auth!.userId;
      await definition.save();
      response.json({ data: definition });
    } catch (error) {
      next(error);
    }
  },
);

operationsRouter.post(
  "/custom-definitions/:id/archive",
  requirePermission("settings.customize"),
  async (request, response, next) => {
    try {
      const data = await CustomDefinition.findOneAndUpdate(
        {
          _id: request.params.id,
          organizationId: request.auth!.organizationId,
        },
        { $set: { status: "archived", updatedBy: request.auth!.userId } },
        { new: true },
      );
      if (!data) {
        response.status(404).json({ error: { message: "Custom definition not found" } });
        return;
      }
      response.json({ data });
    } catch (error) {
      next(error);
    }
  },
);
