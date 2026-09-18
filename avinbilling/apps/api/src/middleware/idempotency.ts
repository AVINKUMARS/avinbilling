import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { IdempotencyRecord } from "../models/idempotency.js";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requestHash(request: Request) {
  return createHash("sha256")
    .update(JSON.stringify(request.body ?? null))
    .digest("hex");
}

export async function idempotency(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const key = request.header("Idempotency-Key")?.trim();
  if (!key || !mutationMethods.has(request.method) || !request.auth) {
    next();
    return;
  }

  if (key.length > 100) {
    response.status(400).json({
      error: {
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency key is too long",
      },
    });
    return;
  }

  try {
    const hash = requestHash(request);
    const path = request.originalUrl.split("?")[0] ?? request.originalUrl;
    const previous = await IdempotencyRecord.findOne({
      organizationId: request.auth.organizationId,
      key,
    }).lean();

    if (previous) {
      if (
        previous.method !== request.method ||
        previous.path !== path ||
        previous.requestHash !== hash
      ) {
        response.status(409).json({
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message: "This offline action key was already used for different data",
          },
        });
        return;
      }
      response.status(previous.responseStatus).json(previous.responseBody);
      return;
    }

    const originalJson = response.json.bind(response);
    let responseBody: unknown;
    response.json = ((body: unknown) => {
      responseBody = body;
      return originalJson(body);
    }) as Response["json"];

    response.on("finish", () => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        void IdempotencyRecord.create({
          organizationId: request.auth!.organizationId,
          key,
          method: request.method,
          path,
          requestHash: hash,
          responseStatus: response.statusCode,
          responseBody: responseBody ?? { data: null },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }).catch(() => undefined);
      }
    });
    next();
  } catch (error) {
    next(error);
  }
}
