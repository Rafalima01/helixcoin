import { describe, expect, it } from "vitest";
import { NotificationTemplates } from "@/modules/notifications/templates/notification-templates";
import { formatCurrency } from "@/lib/utils";

describe("NotificationTemplates", () => {
  it("DEPOSIT_CONFIRMED matches the spec's copy exactly (emoji + jogador + valor)", () => {
    const result = NotificationTemplates.DEPOSIT_CONFIRMED({ userName: "João", amountCents: 50000 });
    expect(result.title).toBe("💰 Novo depósito");
    expect(result.body).toContain("Jogador João");
    expect(result.body).toContain(formatCurrency(500));
    expect(result.priority).toBe("normal");
  });

  it("WITHDRAW_REQUESTED is high priority", () => {
    const result = NotificationTemplates.WITHDRAW_REQUESTED({ userName: "Maria", amountCents: 120000 });
    expect(result.title).toBe("🏦 Nova solicitação de saque");
    expect(result.body).toContain("Maria");
    expect(result.body).toContain(formatCurrency(1200));
    expect(result.priority).toBe("high");
  });

  it("WITHDRAW_APPROVED / WITHDRAW_REJECTED match the spec's emojis", () => {
    expect(NotificationTemplates.WITHDRAW_APPROVED({ amountCents: 80000 }).title).toBe("✅ Saque aprovado");
    expect(NotificationTemplates.WITHDRAW_REJECTED().title).toBe("❌ Saque recusado");
  });

  it("MANAGER_REQUESTED / AFFILIATE_REQUESTED match the spec's emojis", () => {
    expect(NotificationTemplates.MANAGER_REQUESTED().title).toBe("👤 Novo gerente aguardando aprovação");
    expect(NotificationTemplates.AFFILIATE_REQUESTED().title).toBe("🤝 Novo afiliado aguardando aprovação");
  });

  it("DAILY_SUMMARY includes all five numbers from the spec's example", () => {
    const result = NotificationTemplates.DAILY_SUMMARY({
      depositsTotalCents: 1000000,
      withdrawsTotalCents: 300000,
      newPlayers: 12,
      newAffiliates: 3,
      newManagers: 1,
    });
    expect(result.title).toBe("📊 Resumo do dia");
    expect(result.body).toContain(`Depósitos: ${formatCurrency(10000)}`);
    expect(result.body).toContain(`Saques: ${formatCurrency(3000)}`);
    expect(result.body).toContain("Novos jogadores: 12");
    expect(result.body).toContain("Novos afiliados: 3");
    expect(result.body).toContain("Novos gerentes: 1");
  });

  it("SYSTEM_CRITICAL_ALERT is high priority and carries the message", () => {
    const result = NotificationTemplates.SYSTEM_CRITICAL_ALERT({ message: "Gateway MOCK está OFFLINE" });
    expect(result.title).toBe("🚨 Alerta crítico do sistema");
    expect(result.body).toBe("Gateway MOCK está OFFLINE");
    expect(result.priority).toBe("high");
  });

  it("MANAGER_NETWORK_* templates use manager-facing deep links, distinct from admin ones", () => {
    const deposit = NotificationTemplates.MANAGER_NETWORK_DEPOSIT_CONFIRMED({ userName: "Ana", amountCents: 5000 });
    const affiliate = NotificationTemplates.MANAGER_NETWORK_AFFILIATE_REQUESTED();
    expect(deposit.deepLink).toContain("manager");
    expect(affiliate.deepLink).toContain("manager");
  });

  it("every template result carries a non-empty icon and deepLink", () => {
    const results = [
      NotificationTemplates.DEPOSIT_CONFIRMED({ userName: "x", amountCents: 1 }),
      NotificationTemplates.WITHDRAW_REQUESTED({ userName: "x", amountCents: 1 }),
      NotificationTemplates.WITHDRAW_APPROVED({ amountCents: 1 }),
      NotificationTemplates.WITHDRAW_REJECTED(),
      NotificationTemplates.MANAGER_REQUESTED(),
      NotificationTemplates.AFFILIATE_REQUESTED(),
      NotificationTemplates.DAILY_SUMMARY({ depositsTotalCents: 0, withdrawsTotalCents: 0, newPlayers: 0, newAffiliates: 0, newManagers: 0 }),
      NotificationTemplates.SYSTEM_CRITICAL_ALERT({ message: "x" }),
      NotificationTemplates.MANAGER_NETWORK_DEPOSIT_CONFIRMED({ userName: "x", amountCents: 1 }),
      NotificationTemplates.MANAGER_NETWORK_AFFILIATE_REQUESTED(),
      NotificationTemplates.TEST(),
    ];
    for (const result of results) {
      expect(result.icon).toBeTruthy();
      expect(result.deepLink).toBeTruthy();
      expect(["normal", "high"]).toContain(result.priority);
    }
  });

  it("TEST matches the spec's exact copy: title, body, HIGH priority", () => {
    const result = NotificationTemplates.TEST();
    expect(result.title).toBe("HelixCoin");
    expect(result.body).toContain("Push Notifications configuradas com sucesso");
    expect(result.body).toContain("Seu dispositivo está pronto para receber notificações da plataforma");
    expect(result.priority).toBe("high");
  });
});
