/**
 * Base of every intentional error the backend throws. "Intentional" is the
 * key word — an AppError is something a service raised on purpose (a
 * validation failure, a business rule violation, a missing entity) and is
 * always safe to serialize back to the client. Anything that ISN'T an
 * AppError reaching the error handler is a bug and gets logged as one
 * (see error-handler.ts) — that's what `isOperational` encodes.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  /** Stable machine-readable code, e.g. "VALIDATION_ERROR" — never message text. */
  abstract readonly code: string;
  /** True for expected/handled failures; false marks a genuine bug. */
  readonly isOperational: boolean = true;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = "VALIDATION_ERROR";
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";
  constructor(message = "Authentication required") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";
  constructor(message = "You do not have permission to perform this action") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";
  constructor(entity = "Resource") {
    super(`${entity} not found`);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";
}

/** A business/domain rule was violated (e.g. "cashout below target multiplier"). */
export class BusinessRuleError extends AppError {
  readonly statusCode = 422;
  readonly code = "BUSINESS_RULE_VIOLATION";
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = "RATE_LIMITED";
  readonly retryAfterSeconds?: number;
  constructor(message = "Too many requests", retryAfterSeconds?: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DatabaseError extends AppError {
  readonly statusCode = 500;
  readonly code = "DATABASE_ERROR";
  readonly isOperational = false;
}

export class ExternalServiceError extends AppError {
  readonly statusCode = 502;
  readonly code = "EXTERNAL_SERVICE_ERROR";
  constructor(service: string, message?: string) {
    super(message ?? `Upstream service "${service}" failed`);
  }
}

/** Catch-all for anything unexpected — never thrown directly, only wrapped. */
export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = "INTERNAL_ERROR";
  readonly isOperational = false;
  constructor(message = "An unexpected error occurred") {
    super(message);
  }
}
