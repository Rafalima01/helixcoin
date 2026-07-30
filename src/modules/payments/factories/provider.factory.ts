import { decrypt } from "@/server/security/crypto-utils";
import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { VeoPagProvider } from "@/modules/payments/providers/veopag/veopag.provider";
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
    if (credential.provider === "VEOPAG") {
      // `credentials.publicKey`/`privateKey` — same generic JSON blob the
      // admin "Chave pública"/"Chave privada" fields already write (see
      // src/app/admin/gateways/page.tsx), reused here as client_id/client_secret.
      const raw = JSON.parse(decrypt(credential.credentialsEncrypted)) as { publicKey?: string; privateKey?: string };
      return new VeoPagProvider({
        credentialId: credential.id,
        clientId: raw.publicKey ?? "",
        clientSecret: raw.privateKey ?? "",
      });
    }
    return new NotImplementedProvider(credential.provider);
  }
}
