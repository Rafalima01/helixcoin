import { describe, expect, it } from "vitest";
import { MfaService } from "@/modules/identity/services/mfa.service";
import { InMemoryMfaMethodRepository } from "@/modules/identity/repositories/mfa.in-memory-repository";
import { BusinessRuleError } from "@/server/errors";

/**
 * MFA_ENABLED defaults to "false" (see tests/setup.ts / vitest.config.ts —
 * it's intentionally left unset there), which is also the real production
 * default until a TOTP/SMS/Email OTP integration lands. These tests assert
 * that off-by-default behavior: status is readable, every mutation is a
 * guarded stub.
 */
function buildService() {
  const repo = new InMemoryMfaMethodRepository();
  return { service: new MfaService(repo), repo };
}

describe("MfaService.getStatus", () => {
  it("reports disabled with no methods for a fresh user", async () => {
    const { service } = buildService();
    const status = await service.getStatus("user_1");
    expect(status.enabled).toBe(false);
    expect(status.featureAvailable).toBe(false);
    expect(status.methods).toEqual([]);
    expect(status.recoveryCodesRemaining).toBe(0);
  });
});

describe("MfaService mutating methods", () => {
  it("enroll/verify/disable/regenerateRecoveryCodes all reject while the feature is unavailable", async () => {
    const { service } = buildService();
    await expect(service.enroll()).rejects.toThrow(BusinessRuleError);
    await expect(service.verify()).rejects.toThrow(BusinessRuleError);
    await expect(service.disable()).rejects.toThrow(BusinessRuleError);
    await expect(service.regenerateRecoveryCodes()).rejects.toThrow(BusinessRuleError);
  });
});
