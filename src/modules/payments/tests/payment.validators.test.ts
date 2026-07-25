import { describe, expect, it } from "vitest";
import {
  createDepositSchema,
  requestWithdrawSchema,
  adminWithdrawDecisionSchema,
  gatewayCredentialCreateSchema,
} from "@/modules/payments/validators/payments.validator";

describe("payments validators", () => {
  it("createDepositSchema rejects a non-positive amount", () => {
    expect(createDepositSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(createDepositSchema.safeParse({ amount: -10 }).success).toBe(false);
    expect(createDepositSchema.safeParse({ amount: 50 }).success).toBe(true);
  });

  it("requestWithdrawSchema requires a plausible pixKey", () => {
    expect(requestWithdrawSchema.safeParse({ amount: 100, pixKey: "ab" }).success).toBe(false);
    expect(requestWithdrawSchema.safeParse({ amount: 100, pixKey: "user@example.com" }).success).toBe(true);
  });

  it("adminWithdrawDecisionSchema requires rejectionReason only when action is REJECT", () => {
    expect(adminWithdrawDecisionSchema.safeParse({ action: "APPROVE" }).success).toBe(true);
    expect(adminWithdrawDecisionSchema.safeParse({ action: "REJECT" }).success).toBe(false);
    expect(
      adminWithdrawDecisionSchema.safeParse({ action: "REJECT", rejectionReason: "Chave inválida" }).success
    ).toBe(true);
  });

  it("gatewayCredentialCreateSchema enforces a minimum webhook secret length", () => {
    expect(
      gatewayCredentialCreateSchema.safeParse({ name: "Mock", provider: "MOCK", webhookSecret: "short" }).success
    ).toBe(false);
    expect(
      gatewayCredentialCreateSchema.safeParse({ name: "Mock", provider: "MOCK", webhookSecret: "a-long-enough-secret" })
        .success
    ).toBe(true);
  });

  it("gatewayCredentialCreateSchema rejects an unknown provider", () => {
    expect(
      gatewayCredentialCreateSchema.safeParse({ name: "X", provider: "STRIPE", webhookSecret: "a-long-enough-secret" })
        .success
    ).toBe(false);
  });
});
