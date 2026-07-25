import type { NextRequest } from "next/server";
import { ok, created } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import { paymentsContainer } from "@/modules/payments/container";
import {
  createDepositSchema,
  simulateDepositSchema,
  requestWithdrawSchema,
  gatewayProviderSchema,
} from "@/modules/payments/validators/payments.validator";
import { toDepositDto } from "@/modules/payments/dto/payments.dto";
import { roundToCents } from "@/lib/multiplier";

const { paymentService } = paymentsContainer;

/**
 * Thin HTTP adapters — validate → call PaymentService → shape the response.
 * No gateway selection or balance math here; PaymentService owns routing/
 * failover and is the only caller of WalletService (see that module's
 * README — Wallet remains the sole writer of balances).
 */
export async function handleCreateDeposit(req: NextRequest, auth: AuthContext) {
  const body = createDepositSchema.parse(await req.json());
  const amountCents = roundToCents(body.amount);
  const result = await paymentService.createDeposit(auth.userId, amountCents);
  return created(result);
}

export async function handleGetDeposit(_req: NextRequest, auth: AuthContext, depositId: string) {
  const deposit = await paymentService.getDeposit(depositId, auth.userId);
  return ok(toDepositDto(deposit));
}

export async function handleSimulateDeposit(req: NextRequest, auth: AuthContext, depositId: string) {
  const body = simulateDepositSchema.parse(await req.json().catch(() => ({})));
  const result = await paymentService.simulateDeposit(depositId, auth.userId, body.outcome);
  return ok(result);
}

export async function handleRequestWithdraw(req: NextRequest, auth: AuthContext) {
  const body = requestWithdrawSchema.parse(await req.json());
  const amountCents = roundToCents(body.amount);
  const { ip, userAgent } = extractRequestMeta(req);
  const result = await paymentService.requestWithdraw(auth.userId, amountCents, body.pixKey, body.pixKeyType, {
    actorId: auth.userId,
    actorType: "USER",
    ip,
    userAgent,
  });
  return created(result);
}

/** `POST /api/payments/webhook/{provider}` — no auth, raw body (signatures are verified over the raw string, never parsed JSON), rate-limited by IP (see the route file). */
export async function handleWebhook(req: NextRequest, provider: string) {
  const parsedProvider = gatewayProviderSchema.parse(provider);
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-mock-signature") ?? req.headers.get("x-signature");
  const result = await paymentService.handleWebhook(parsedProvider, rawBody, signatureHeader);
  return ok(result, undefined, result.status);
}
