import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { toErrorResult } from "@/server/errors/error-handler";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/server/errors/app-error";

describe("toErrorResult", () => {
  it("maps a known AppError to its own status and code", () => {
    const result = toErrorResult(new NotFoundError("Match"));
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe("NOT_FOUND");
    expect(result.body.error.message).toBe("Match not found");
  });

  it("maps a BusinessRuleError to 422", () => {
    const result = toErrorResult(new BusinessRuleError("Goal not reached"));
    expect(result.status).toBe(422);
    expect(result.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("maps a ZodError to a 400 VALIDATION_ERROR with flattened details", () => {
    const schema = z.object({ amount: z.number().positive() });
    const parsed = schema.safeParse({ amount: -5 });
    expect(parsed.success).toBe(false);
    const result = toErrorResult(parsed.error as ZodError);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.body.error.details).toBeDefined();
  });

  it("maps a plain Error to a 500 INTERNAL_ERROR without leaking a stack trace", () => {
    const result = toErrorResult(new Error("kaboom"));
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL_ERROR");
    expect(result.body).not.toHaveProperty("stack");
  });

  it("maps a non-Error throw (e.g. a rejected string) to a generic 500", () => {
    const result = toErrorResult("just a string");
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("preserves the operational ValidationError message verbatim", () => {
    const result = toErrorResult(new ValidationError("Bet amount must be at least R$1"));
    expect(result.body.error.message).toBe("Bet amount must be at least R$1");
  });
});
