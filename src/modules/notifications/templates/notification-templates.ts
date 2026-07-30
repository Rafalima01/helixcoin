import { formatCurrency } from "@/lib/utils";
import { zoneUrl } from "@/config/domains";

export interface NotificationTemplateResult {
  title: string;
  body: string;
  icon: string;
  deepLink: string;
  priority: "normal" | "high";
}

const ICON = "/icon-192.png";

function money(cents: number): string {
  return formatCurrency(cents / 100);
}

/**
 * One builder per NotificationCategory, copy/emoji exactly as specified.
 * NotificationDispatcher is the only caller — it already knows which
 * category a domain event maps to, so each builder takes just the context
 * that category's copy needs, not a shared do-everything shape.
 */
export const NotificationTemplates = {
  DEPOSIT_CONFIRMED(ctx: { userName: string; amountCents: number }): NotificationTemplateResult {
    return {
      title: "💰 Novo depósito",
      body: `Jogador ${ctx.userName}\n${money(ctx.amountCents)}\nConfirmado agora`,
      icon: ICON,
      deepLink: zoneUrl("admin", "/deposits"),
      priority: "normal",
    };
  },

  WITHDRAW_REQUESTED(ctx: { userName: string; amountCents: number }): NotificationTemplateResult {
    return {
      title: "🏦 Nova solicitação de saque",
      body: `${ctx.userName}\n${money(ctx.amountCents)}`,
      icon: ICON,
      deepLink: zoneUrl("admin", "/withdrawals"),
      priority: "high",
    };
  },

  WITHDRAW_APPROVED(ctx: { amountCents: number }): NotificationTemplateResult {
    return {
      title: "✅ Saque aprovado",
      body: money(ctx.amountCents),
      icon: ICON,
      deepLink: zoneUrl("admin", "/withdrawals"),
      priority: "normal",
    };
  },

  WITHDRAW_REJECTED(): NotificationTemplateResult {
    return {
      title: "❌ Saque recusado",
      body: "Um saque foi recusado",
      icon: ICON,
      deepLink: zoneUrl("admin", "/withdrawals"),
      priority: "normal",
    };
  },

  MANAGER_REQUESTED(): NotificationTemplateResult {
    return {
      title: "👤 Novo gerente aguardando aprovação",
      body: "Uma nova solicitação de cadastro de gerente chegou",
      icon: ICON,
      deepLink: zoneUrl("admin", "/managers/requests"),
      priority: "normal",
    };
  },

  AFFILIATE_REQUESTED(): NotificationTemplateResult {
    return {
      title: "🤝 Novo afiliado aguardando aprovação",
      body: "Uma nova solicitação de afiliado chegou",
      icon: ICON,
      deepLink: zoneUrl("admin", "/affiliates"),
      priority: "normal",
    };
  },

  DAILY_SUMMARY(ctx: {
    depositsTotalCents: number;
    withdrawsTotalCents: number;
    newPlayers: number;
    newAffiliates: number;
    newManagers: number;
  }): NotificationTemplateResult {
    return {
      title: "📊 Resumo do dia",
      body: `Depósitos: ${money(ctx.depositsTotalCents)}\nSaques: ${money(ctx.withdrawsTotalCents)}\nNovos jogadores: ${ctx.newPlayers}\nNovos afiliados: ${ctx.newAffiliates}\nNovos gerentes: ${ctx.newManagers}`,
      icon: ICON,
      deepLink: zoneUrl("admin", "/analytics"),
      priority: "normal",
    };
  },

  SYSTEM_CRITICAL_ALERT(ctx: { message: string }): NotificationTemplateResult {
    return {
      title: "🚨 Alerta crítico do sistema",
      body: ctx.message,
      icon: ICON,
      deepLink: zoneUrl("admin", "/gateways"),
      priority: "high",
    };
  },

  MANAGER_NETWORK_DEPOSIT_CONFIRMED(ctx: { userName: string; amountCents: number }): NotificationTemplateResult {
    return {
      title: "💰 Novo depósito",
      body: `Jogador: ${ctx.userName}\nValor: ${money(ctx.amountCents)}`,
      icon: ICON,
      deepLink: zoneUrl("manager", "/network"),
      priority: "normal",
    };
  },

  MANAGER_NETWORK_AFFILIATE_REQUESTED(): NotificationTemplateResult {
    return {
      title: "🤝 Novo afiliado aguardando aprovação",
      body: "Um novo afiliado da sua rede está aguardando aprovação",
      icon: ICON,
      deepLink: zoneUrl("manager", "/network"),
      priority: "normal",
    };
  },

  /** "Enviar Notificação de Teste" button (admin push-notifications page) — never triggered by a domain event, only by NotificationDispatcherService.sendTestNotification(). */
  TEST(): NotificationTemplateResult {
    return {
      title: "HelixCoin",
      body: "✅ Push Notifications configuradas com sucesso.\n\nSeu dispositivo está pronto para receber notificações da plataforma.",
      icon: ICON,
      deepLink: zoneUrl("admin", "/"),
      priority: "high",
    };
  },
} as const;
