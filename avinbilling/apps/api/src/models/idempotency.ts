import { Schema, model } from "mongoose";

const idempotencyRecordSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    requestHash: { type: String, required: true },
    responseStatus: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

idempotencyRecordSchema.index(
  { organizationId: 1, key: 1 },
  { unique: true },
);
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyRecord = model(
  "IdempotencyRecord",
  idempotencyRecordSchema,
);
