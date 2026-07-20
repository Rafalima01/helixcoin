import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { createChildLogger } from "@/server/logger";
import { captureException } from "@/server/observability/sentry";
import {
  AppError,
  InternalError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";

const logger = createChildLogger({ module: "error-handler" });

/** Framework-agnostic shape — src/server/http turns this into a NextResponse. */
export interface ErrorResult {
  status: number;
  body: {
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
}

/**
 * Normalizes anything a route handler / service can throw into one
 * response shape, and logs it at the right level. This is the single
 * place that decides "is this our fault or theirs" — 4xx (operational,
 * expected) logs at `warn`; 5xx (bugs, infra failures) logs at `error`
 * with the full stack, since those need someone paged, not just noted.
 */
export function toErrorResult(error: unknown, context?: Record<string, unknown>): ErrorResult {
  const mapped = mapError(error);

  const logPayload = { ...context, code: mapped.code, statusCode: mapped.statusCode };
  if (mapped.statusCode >= 500) {
    logger.error({ ...logPayload, err: error }, mapped.message);
    // Only genuine bugs/infra failures page someone — a mapped 4xx
    // (validation, not-found, business rule) is expected traffic, not an
    // incident.
    captureException(error, context);
  } else {
    logger.warn(logPayload, mapped.message);
  }

  return {
    status: mapped.statusCode,
    body: {
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details !== undefined ? { details: mapped.details } : {}),
      },
    },
  };
}

function mapError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new ValidationError("Invalid input", error.flatten());
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(error);
  }

  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  return new InternalError("An unexpected error occurred");
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case "P2002": // unique constraint
      return new ConflictError(
        `Duplicate value for ${(error.meta?.target as string[])?.join(", ") ?? "field"}`
      );
    case "P2025": // record not found
      return new NotFoundError();
    default:
      return new InternalError(`Database error (${error.code})`);
  }
}
