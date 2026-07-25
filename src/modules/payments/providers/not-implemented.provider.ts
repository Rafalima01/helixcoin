import { ExternalServiceError } from "@/server/errors";
import type {
  PaymentProvider,
  CreatePixDepositInput,
  CreatePixDepositResult,
  GetDepositResult,
  CancelDepositResult,
  CreateWithdrawInput,
  CreateWithdrawResult,
  GetWithdrawResult,
  ValidateWebhookInput,
  ValidateWebhookResult,
  ProviderHealthResult,
} from "@/modules/payments/interfaces/payment-provider.interface";
import type { GatewayProvider } from "@/modules/payments/entities/payments.entity";

/**
 * Shared stand-in for every GatewayProvider enum value other than MOCK
 * (Cartpanda, CartWaveHub, Mercado Pago, Pay4Fun, BSPay, Pay2M, OpenPix,
 * Outros) — this phase only ships a functional Mock integration. Registering
 * a credential for one of these providers is allowed (the admin CRUD + enum
 * + ProviderFactory branch is "estrutura pronta"), but any real call throws.
 * `health()` deliberately returns OFFLINE instead of throwing so
 * GatewayRouterService's health filter naturally excludes these credentials
 * from routing without special-casing "not implemented" as its own state.
 */
export class NotImplementedProvider implements PaymentProvider {
  constructor(readonly name: GatewayProvider) {}

  private fail(): never {
    throw new ExternalServiceError(this.name, `Gateway ${this.name} ainda não implementado nesta fase`);
  }

  async createPixDeposit(_input: CreatePixDepositInput): Promise<CreatePixDepositResult> {
    this.fail();
  }

  async getDeposit(_input: { providerTransactionId: string }): Promise<GetDepositResult> {
    this.fail();
  }

  async cancelDeposit(_input: { providerTransactionId: string }): Promise<CancelDepositResult> {
    this.fail();
  }

  async createWithdraw(_input: CreateWithdrawInput): Promise<CreateWithdrawResult> {
    this.fail();
  }

  async getWithdraw(_input: { providerTransactionId: string }): Promise<GetWithdrawResult> {
    this.fail();
  }

  async validateWebhook(_input: ValidateWebhookInput): Promise<ValidateWebhookResult> {
    this.fail();
  }

  async health(): Promise<ProviderHealthResult> {
    return { status: "OFFLINE", latencyMs: 0, message: `${this.name} ainda não implementado` };
  }
}
