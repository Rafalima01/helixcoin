import { decrypt } from "@/server/security/crypto-utils";
import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { NotImplementedProvider } from "@/modules/payments/providers/not-implemented.provider";
import type { PaymentProvider } from "@/modules/payments/interfaces/payment-provider.interface";
import type { GatewayCredential } from "@/modules/payments/entities/payments.entity";

/**
 * Sole job: decrypt a credential's secrets and instantiate the right
 * PaymentProvider. Called fresh for every attempt (never cached) so a
 * mid-session admin edit — most notably flipping `simulatedHealth` — takes
 * effect on the very next call, no restart required.
 */
export class ProviderFactory {
  static create(credential: GatewayCredential): PaymentProvider {
    if (credential.provider === "MOCK") {
      const webhookSecret = decrypt(credential.webhookSecretEncrypted);
      return new MockProvider({
        webhookSecret,
        simulatedHealth: credential.simulatedHealth,
        simulatedErrorMode: credential.simulatedErrorMode,
      });
    }
    return new NotImplementedProvider(credential.provider);
  }
}
