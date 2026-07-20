import type { IMfaMethodRepository } from "@/modules/identity/interfaces/mfa-repository.interface";
import { env } from "@/server/config/env";
import { BusinessRuleError } from "@/server/errors";

export interface MfaStatusDto {
  enabled: boolean;
  featureAvailable: boolean;
  methods: { type: string; enabled: boolean; verifiedAt: string | null }[];
  recoveryCodesRemaining: number;
}

/**
 * MFA is fully modeled at the schema level (MfaMethod/MfaRecoveryCode,
 * TOTP/EMAIL/SMS) but has no real verification flow yet — no TOTP secret
 * generation, no OTP dispatch, no recovery-code issuance. Every mutating
 * method here is a deliberate stub gated by MFA_ENABLED (defaults off) so
 * the rest of the platform (profile UI, admin) can already read/display MFA
 * status without the feature actually being enrollable until that
 * integration is built.
 */
export class MfaService {
  constructor(private readonly methods: IMfaMethodRepository) {}

  async getStatus(userId: string): Promise<MfaStatusDto> {
    const [methods, recoveryCodesRemaining] = await Promise.all([
      this.methods.listByUser(userId),
      this.methods.countRecoveryCodes(userId),
    ]);

    return {
      enabled: methods.some((m) => m.enabled),
      featureAvailable: env.MFA_ENABLED,
      methods: methods.map((m) => ({
        type: m.type,
        enabled: m.enabled,
        verifiedAt: m.verifiedAt?.toISOString() ?? null,
      })),
      recoveryCodesRemaining,
    };
  }

  async enroll(): Promise<never> {
    this.assertAvailable();
    throw new BusinessRuleError("Integração de MFA ainda não implementada");
  }

  async verify(): Promise<never> {
    this.assertAvailable();
    throw new BusinessRuleError("Integração de MFA ainda não implementada");
  }

  async disable(): Promise<never> {
    this.assertAvailable();
    throw new BusinessRuleError("Integração de MFA ainda não implementada");
  }

  async regenerateRecoveryCodes(): Promise<never> {
    this.assertAvailable();
    throw new BusinessRuleError("Integração de MFA ainda não implementada");
  }

  private assertAvailable(): void {
    if (!env.MFA_ENABLED) throw new BusinessRuleError("MFA não está disponível nesta plataforma no momento");
  }
}
