import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

/**
 * `PaymentService.requestWithdraw` envolve a criação num lock distribuído
 * (CacheService.withLock → Redis). A suíte unitária deste projeto não
 * contata Redis nem Postgres de verdade (ver tests/helpers/README.md), então
 * o lock é substituído por um in-process que preserva a semântica que
 * importa aqui: executa a função e devolve o resultado.
 */
vi.mock("@/server/cache/cache.service", () => ({
  CacheService: {
    withLock: vi.fn(async <T,>(_key: string, _ttlMs: number, fn: () => Promise<T>) => fn()),
    remember: vi.fn(async <T,>(_key: string, _ttl: number, fn: () => Promise<T>) => fn()),
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
  },
}));

import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";
import { BusinessRuleError } from "@/server/errors";
import { ProviderFactory } from "@/modules/payments/factories/provider.factory";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";

/**
 * Saque SIMULADO de Conta Demo (src/modules/demo-accounts).
 *
 * O ponto central destes testes não é só "o fluxo funciona", e sim provar as
 * garantias de segurança: nenhuma chamada de gateway acontece, nenhuma linha
 * simulada consegue existir com credencial, e nenhuma pode ser liquidada pelo
 * caminho de webhook.
 */
describe("PaymentService — saque simulado (Conta Demo)", () => {
  async function seedDemoUserWithBalance(
    harness: Awaited<ReturnType<typeof buildPaymentTestHarness>>,
    balanceCents = 50_000
  ) {
    const user = await harness.users.create({
      firstName: "Conta",
      lastName: "Demo",
      username: `demo${Math.random().toString().slice(2, 8)}`,
      email: `demo${Math.random().toString().slice(2, 8)}@demo.helixcoin.internal`,
      passwordHash: "hash",
      referralCode: `D${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      status: "ACTIVE",
      role: "USER",
      isDemo: true,
      tags: ["demo"],
    });
    await harness.walletService.adjust({
      userId: user.id,
      amountCents: balanceCents,
      reason: "saldo demo",
      observation: "setup de teste",
      idempotencyKey: `test-balance:${user.id}`,
      actor: { actorId: user.id, actorType: "USER" },
    });
    return user;
  }

  const actorFor = (userId: string): WalletActor => ({ actorId: userId, actorType: "USER" });

  it("cria a solicitação como PENDING, simulada e sem gateway", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness);

    const result = await harness.paymentService.requestWithdraw(user.id, 10_000, "chave@pix.com", "EMAIL", actorFor(user.id));

    expect(result.status).toBe("PENDING");
    const row = await harness.withdraws.findById(result.withdrawId);
    expect(row?.isSimulated).toBe(true);
    expect(row?.gatewayCredentialId).toBeNull();
    expect(row?.providerTransactionId).toBeNull();
    expect(row?.pixKeyType).toBe("EMAIL");
  });

  it("SEGURANÇA: nenhum provider é instanciado durante um saque simulado", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness);

    // Espiona a única porta de entrada para qualquer chamada de gateway do
    // módulo — se um saque simulado tentasse falar com um provedor, teria
    // obrigatoriamente que passar por aqui.
    const factorySpy = vi.spyOn(ProviderFactory, "create");

    const created = await harness.paymentService.requestWithdraw(user.id, 7_500, "chave-pix", "CPF", actorFor(user.id));
    await harness.paymentService.decideWithdraw(created.withdrawId, "APPROVE", undefined);

    expect(factorySpy).not.toHaveBeenCalled();
    factorySpy.mockRestore();
  });

  it("SEGURANÇA: nenhum webhook é registrado no fluxo simulado", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness);

    const created = await harness.paymentService.requestWithdraw(user.id, 5_000, "chave-pix", "CPF", actorFor(user.id));
    await harness.paymentService.decideWithdraw(created.withdrawId, "APPROVE", undefined);

    const { total } = await harness.webhooks.listAdmin({ page: 1, pageSize: 50 });
    expect(total).toBe(0);
  });

  it("reduz o saldo disponível imediatamente ao solicitar", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness, 50_000);

    await harness.paymentService.requestWithdraw(user.id, 10_000, "chave-pix", "CPF", actorFor(user.id));

    const balances = await harness.walletService.getBalance(user.id);
    expect(balances.main).toBe(40_000); // saldo exibido ao jogador
    expect(balances.locked).toBe(10_000);
  });

  it("aprovar mantém o saldo reduzido e marca APPROVED", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness, 50_000);

    const created = await harness.paymentService.requestWithdraw(user.id, 10_000, "chave-pix", "CPF", actorFor(user.id));
    await harness.paymentService.decideWithdraw(created.withdrawId, "APPROVE", undefined);

    const row = await harness.withdraws.findById(created.withdrawId);
    expect(row?.status).toBe("APPROVED");
    expect(row?.processedAt).not.toBeNull();

    const balances = await harness.walletService.getBalance(user.id);
    expect(balances.main).toBe(40_000);
    expect(balances.locked).toBe(0);
  });

  it("recusar devolve o valor ao saldo disponível e registra o motivo", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness, 50_000);

    const created = await harness.paymentService.requestWithdraw(user.id, 10_000, "chave-pix", "CPF", actorFor(user.id));
    await harness.paymentService.decideWithdraw(created.withdrawId, "REJECT", "chave inválida");

    const row = await harness.withdraws.findById(created.withdrawId);
    expect(row?.status).toBe("REJECTED");
    expect(row?.rejectionReason).toBe("chave inválida");

    const balances = await harness.walletService.getBalance(user.id);
    expect(balances.main).toBe(50_000);
    expect(balances.locked).toBe(0);
  });

  it("uma segunda decisão sobre a mesma solicitação é recusada (CAS)", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness, 50_000);

    const created = await harness.paymentService.requestWithdraw(user.id, 10_000, "chave-pix", "CPF", actorFor(user.id));
    await harness.paymentService.decideWithdraw(created.withdrawId, "APPROVE", undefined);

    await expect(
      harness.paymentService.decideWithdraw(created.withdrawId, "REJECT", "tentativa dupla")
    ).rejects.toThrow(BusinessRuleError);

    // O saldo não pode ter sido debitado E desbloqueado.
    const balances = await harness.walletService.getBalance(user.id);
    expect(balances.main).toBe(40_000);
    expect(balances.locked).toBe(0);
  });

  it("respeita o saldo demo: solicitar mais do que existe é recusado", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness, 5_000);

    await expect(
      harness.paymentService.requestWithdraw(user.id, 4_000_00, "chave-pix", "CPF", actorFor(user.id))
    ).rejects.toThrow();
  });

  it("o reconciliador nunca enxerga uma solicitação simulada", async () => {
    const harness = await buildPaymentTestHarness();
    const user = await seedDemoUserWithBalance(harness);

    await harness.paymentService.requestWithdraw(user.id, 5_000, "chave-pix", "CPF", actorFor(user.id));

    // Cutoff no futuro: qualquer linha PENDING real seria devolvida aqui.
    const stuck = await harness.withdraws.findStuckPending(new Date(Date.now() + 60_000));
    expect(stuck).toHaveLength(0);
  });

  it("conta REAL continua passando pelo gateway e não é marcada como simulada", async () => {
    const harness = await buildPaymentTestHarness();
    const realUser = await harness.users.create({
      firstName: "Jogador",
      lastName: "Real",
      username: "realplayer1",
      email: "real1@test.com",
      passwordHash: "hash",
      referralCode: "REAL1111",
      status: "ACTIVE",
      role: "USER",
    });
    await harness.walletService.adjust({
      userId: realUser.id,
      amountCents: 50_000,
      reason: "saldo",
      observation: "setup de teste",
      idempotencyKey: `test-balance:${realUser.id}`,
      actor: { actorId: realUser.id, actorType: "USER" },
    });

    const created = await harness.paymentService.requestWithdraw(
      realUser.id,
      10_000,
      "chave-pix",
      "CPF",
      actorFor(realUser.id)
    );

    const row = await harness.withdraws.findById(created.withdrawId);
    expect(row?.isSimulated).toBe(false);
    expect(row?.gatewayCredentialId).toBe(harness.credential.id);
    expect(row?.providerTransactionId).not.toBeNull();
  });
});
