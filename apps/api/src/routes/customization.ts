import { Router } from "express";
import { z } from "zod";
import type { Model } from "mongoose";
import { evaluateFormula } from "@avin/shared";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { Client } from "../models/client.js";
import { Project } from "../models/project.js";
import { MeasurementItem } from "../models/measurement.js";
import { Quote } from "../models/quote.js";
import { CustomDefinition, Invoice } from "../models/operations.js";

export const customizationRouter = Router();
customizationRouter.use(requireAuth);

const entitySchema = z.enum(["client", "project", "measurement", "quote", "invoice"]);
const documentTypeSchema = z.enum(["quotation", "invoice", "delivery-note", "work-order", "completion-certificate"]);
const valueSchema = z.union([z.string().max(2_000), z.number().finite(), z.boolean(), z.null()]);
const valuesSchema = z.record(z.string().regex(/^[a-z][a-zA-Z0-9_-]*$/), valueSchema);
const models = { client: Client, project: Project, measurement: MeasurementItem, quote: Quote, invoice: Invoice } as const;

type RuntimeDefinition = { key: string; name: string; definitionType: string; configuration: Record<string, unknown> };

async function definitionsFor(organizationId: unknown, entity: string) {
  const definitions = await CustomDefinition.find({ organizationId, status: "active" }).sort({ definitionType: 1, name: 1 }).lean();
  return definitions.filter((definition) =>
    definition.definitionType === "document" ||
    (definition.configuration as Record<string, unknown> | undefined)?.entity === entity,
  ) as unknown as RuntimeDefinition[];
}

function runtimeFields(definitions: RuntimeDefinition[]) {
  return definitions.flatMap((definition) => {
    const configuration = definition.configuration;
    if (definition.definitionType === "field") return [{ key: definition.key, ...configuration }];
    if (definition.definitionType === "form" && Array.isArray(configuration.fields)) return configuration.fields as Array<Record<string, unknown>>;
    return [];
  });
}

function validateValues(values: Record<string, string | number | boolean | null>, definitions: RuntimeDefinition[]) {
  const fields = runtimeFields(definitions);
  const allowed = new Map(fields.map((field) => [String(field.key), field]));
  for (const key of Object.keys(values)) if (!allowed.has(key)) throw new Error(`Unknown custom field: ${key}`);
  for (const field of fields) {
    const key = String(field.key);
    const value = values[key];
    if (field.required && (value === undefined || value === null || value === "")) throw new Error(`${String(field.label ?? key)} is required`);
    if (value === undefined || value === null || value === "") continue;
    if (field.fieldType === "number" && typeof value !== "number") throw new Error(`${String(field.label ?? key)} must be a number`);
    if (field.fieldType === "checkbox" && typeof value !== "boolean") throw new Error(`${String(field.label ?? key)} must be true or false`);
    if (["text", "textarea", "date", "select"].includes(String(field.fieldType)) && typeof value !== "string") throw new Error(`${String(field.label ?? key)} must be text`);
    if (field.fieldType === "select" && Array.isArray(field.options) && !(field.options as unknown[]).includes(value)) throw new Error(`${String(field.label ?? key)} has an invalid option`);
  }
}

function calculate(definitions: RuntimeDefinition[], variables: Record<string, unknown>) {
  const numeric = Object.fromEntries(Object.entries(variables).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));
  return Object.fromEntries(definitions.filter((definition) => {
    if (definition.definitionType !== "formula") return false;
    const requiredVariables = Array.isArray(definition.configuration.variables) ? definition.configuration.variables.map(String) : [];
    return requiredVariables.every((variable) => numeric[variable] !== undefined);
  }).map((definition) => {
    const configuration = definition.configuration;
    const result = evaluateFormula(String(configuration.expression), numeric);
    const decimalPlaces = Number(configuration.decimalPlaces ?? 2);
    return [definition.key, Number(result.toFixed(decimalPlaces))];
  }));
}

customizationRouter.get("/runtime/:entity", async (request, response, next) => {
  try {
    const entity = entitySchema.parse(request.params.entity);
    response.json({ data: await definitionsFor(request.auth!.organizationId, entity) });
  } catch (error) { next(error); }
});

customizationRouter.post("/evaluate/:entity", async (request, response, next) => {
  try {
    const entity = entitySchema.parse(request.params.entity);
    const variables = z.record(z.string(), z.number().finite()).parse(request.body.variables);
    const definitions = await definitionsFor(request.auth!.organizationId, entity);
    response.json({ data: calculate(definitions, variables) });
  } catch (error) { next(error); }
});

customizationRouter.patch("/values/:entity/:id", async (request, response, next) => {
  try {
    const entity = entitySchema.parse(request.params.entity);
    const values = valuesSchema.parse(request.body.values);
    const definitions = await definitionsFor(request.auth!.organizationId, entity);
    validateValues(values, definitions);
    const Model = models[entity] as unknown as Model<Record<string, unknown>>;
    const record = await Model.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId });
    if (!record) { response.status(404).json({ error: { message: "Business record not found" } }); return; }
    const base = record.toObject() as Record<string, unknown>;
    const calculatedValues = calculate(definitions, { ...base, ...values });
    record.set("customValues", values);
    record.set("calculatedValues", calculatedValues);
    record.set("updatedBy", request.auth!.userId);
    await record.save();
    response.json({ data: record });
  } catch (error) { next(error); }
});

customizationRouter.post("/workflow/:entity/:id/advance", async (request, response, next) => {
  try {
    const entity = z.enum(["project", "quote"]).parse(request.params.entity);
    const approved = z.object({ approved: z.boolean().default(false) }).parse(request.body ?? {}).approved;
    const definitions = await definitionsFor(request.auth!.organizationId, entity);
    const definition = definitions.find((item) => item.definitionType === "workflow");
    if (!definition) { response.status(404).json({ error: { message: "No active workflow is configured" } }); return; }
    const stages = definition.configuration.stages as Array<{ key: string; label: string; color: string; requiresApproval?: boolean }>;
    const Model = models[entity] as unknown as Model<Record<string, unknown>>;
    const record = await Model.findOne({ _id: request.params.id, organizationId: request.auth!.organizationId });
    if (!record) { response.status(404).json({ error: { message: "Business record not found" } }); return; }
    const workflow = (record.get("customWorkflow") as { definitionKey?: string; currentStageKey?: string; history?: unknown[] } | undefined) ?? {};
    const currentIndex = Math.max(0, stages.findIndex((stage) => stage.key === workflow.currentStageKey));
    const currentStage = stages[currentIndex];
    if (currentStage?.requiresApproval && !approved) { response.status(409).json({ error: { message: "This stage requires approval before continuing" } }); return; }
    const nextStage = stages[Math.min(currentIndex + 1, stages.length - 1)]!;
    record.set("customWorkflow", { definitionKey: definition.key, definitionVersion: (definition as unknown as { version?: number }).version ?? 1, currentStageKey: nextStage.key, completed: nextStage.key === stages.at(-1)?.key, history: [...(workflow.history ?? []), { stageKey: nextStage.key, changedAt: new Date(), changedBy: request.auth!.userId }] });
    record.set("updatedBy", request.auth!.userId);
    await record.save();
    response.json({ data: record });
  } catch (error) { next(error); }
});

customizationRouter.get("/documents/:type", async (request, response, next) => {
  try {
    const documentType = documentTypeSchema.parse(request.params.type);
    const data = await CustomDefinition.findOne({ organizationId: request.auth!.organizationId, status: "active", definitionType: "document", "configuration.documentType": documentType }).sort({ version: -1 }).lean();
    response.json({ data: data ?? null });
  } catch (error) { next(error); }
});

customizationRouter.post("/import", requirePermission("settings.customize"), async (request, response, next) => {
  try {
    const input = z.object({ definitionType: z.enum(["field", "form", "workflow", "formula", "document"]), key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]*$/), name: z.string().trim().min(2).max(120), configuration: z.record(z.string(), z.unknown()) }).parse(request.body);
    const latest = await CustomDefinition.findOne({ organizationId: request.auth!.organizationId, definitionType: input.definitionType, key: input.key }).sort({ version: -1 }).lean();
    const data = await CustomDefinition.create({ ...input, organizationId: request.auth!.organizationId, version: (latest?.version ?? 0) + 1, status: "draft", createdBy: request.auth!.userId, updatedBy: request.auth!.userId });
    response.status(201).json({ data });
  } catch (error) { next(error); }
});
