import type { Queue } from "bullmq";
import { eventBus } from "@/server/events";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import type { DepositEventPayload, WithdrawEventPayload, GatewayHealthEventPayload } from "@/modules/payments/events/payments.events";
import { AFFILIATE_EVENTS } from "@/modules/affiliate/events/affiliate.events";
import type { AffiliateStatusEventPayload } from "@/modules/affiliate/events/affiliate.events";
import { MANAGER_EVENTS } from "@/modules/manager/events/manager.events";
import { DAILY_SUMMARY_EVENTS } from "@/modules/notifications/events/notifications.events";
import type { DailySummaryEventPayload } from "@/modules/notifications/events/notifications.events";
import { NotificationTemplates } from "@/modules/notifications/templates/notification-templates";
import type { NotificationTemplateResult } from "@/modules/notifications/templates/notification-templates";
import type { IPushSubscriptionRepository } from "@/modules/notifications/interfaces/push-subscription-repository.interface";
import type { INotificationPreferenceRepository } from "@/modules/notifications/interfaces/notification-preference-repository.interface";
import type { IPushNotificationLogRepository } from "@/modules/notifications/interfaces/push-notification-log-repository.interface";
import type { INotificationRecipientResolver } from "@/modules/notifications/interfaces/notification-recipient-resolver.interface";
import type { NotificationCategory } from "@/modules/notifications/entities/notifications.entity";
import type { PushNotificationJobData } from "@/modules/notifications/queue/notification-queue";

/**
 * The push module's only inbound door — every other module keeps publishing
 * the same domain events it already does (PAYMENT_EVENTS/AFFILIATE_EVENTS/
 * MANAGER_EVENTS), with zero changes on their side. This class is the sole
 * eventBus.subscribe()-er for push purposes; nothing else in the app is
 * allowed to enqueue a push job directly.
 *
 * Runs in the WEB process (where these events are actually published — see
 * src/server/events/event-bus.ts's doc comment: the bus is in-process only,
 * the standalone worker process never sees a publish() call from here).
 * Dispatching only ever ENQUEUES a BullMQ job per subscription — the actual
 * Web Push send happens later, in the worker process
 * (notification-queue.ts's startPushNotificationsWorker), never inside the
 * HTTP request that triggered the event.
 */
export class NotificationDispatcherService {
  constructor(
    private readonly subscriptions: IPushSubscriptionRepository,
    private readonly preferences: INotificationPreferenceRepository,
    private readonly logs: IPushNotificationLogRepository,
    private readonly recipients: INotificationRecipientResolver,
    private readonly queue: Queue<PushNotificationJobData>
  ) {}

  /** Wired once at container-construction time (see container.ts) — not called directly in application code. */
  subscribeToEvents(): () => void {
    const unsubscribers = [
      eventBus.subscribe<DepositEventPayload>(PAYMENT_EVENTS.depositConfirmed, async (event) => {
        await this.handleDepositConfirmed(event.payload);
      }),
      eventBus.subscribe<WithdrawEventPayload>(PAYMENT_EVENTS.withdrawRequested, async (event) => {
        await this.handleWithdrawRequested(event.payload);
      }),
      eventBus.subscribe<WithdrawEventPayload>(PAYMENT_EVENTS.withdrawApproved, async (event) => {
        await this.dispatchToAdmins("WITHDRAW_APPROVED", NotificationTemplates.WITHDRAW_APPROVED({ amountCents: event.payload.amountCents }));
      }),
      eventBus.subscribe<WithdrawEventPayload>(PAYMENT_EVENTS.withdrawRejected, async () => {
        await this.dispatchToAdmins("WITHDRAW_REJECTED", NotificationTemplates.WITHDRAW_REJECTED());
      }),
      eventBus.subscribe<AffiliateStatusEventPayload>(AFFILIATE_EVENTS.created, async (event) => {
        await this.handleAffiliateCreated(event.payload);
      }),
      eventBus.subscribe<{ inviteId: string; userId: string }>(MANAGER_EVENTS.inviteAccepted, async () => {
        await this.dispatchToAdmins("MANAGER_REQUESTED", NotificationTemplates.MANAGER_REQUESTED());
      }),
      eventBus.subscribe<GatewayHealthEventPayload>(PAYMENT_EVENTS.gatewayUnavailable, async (event) => {
        await this.handleGatewayUnavailable(event.payload);
      }),
      eventBus.subscribe<DailySummaryEventPayload>(DAILY_SUMMARY_EVENTS.generated, async (event) => {
        await this.dispatchToAdmins("DAILY_SUMMARY", NotificationTemplates.DAILY_SUMMARY(event.payload));
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private async handleDepositConfirmed(payload: DepositEventPayload): Promise<void> {
    const userName = await this.recipients.getUserDisplayName(payload.userId);
    await this.dispatchToAdmins("DEPOSIT_CONFIRMED", NotificationTemplates.DEPOSIT_CONFIRMED({ userName, amountCents: payload.amountCents }));

    const managerUserId = await this.recipients.resolveManagerUserIdForUser(payload.userId);
    if (managerUserId) {
      const template = NotificationTemplates.MANAGER_NETWORK_DEPOSIT_CONFIRMED({ userName, amountCents: payload.amountCents });
      await this.dispatchToUser(managerUserId, "MANAGER_NETWORK_DEPOSIT_CONFIRMED", template);
    }
  }

  private async handleWithdrawRequested(payload: WithdrawEventPayload): Promise<void> {
    const userName = await this.recipients.getUserDisplayName(payload.userId);
    await this.dispatchToAdmins("WITHDRAW_REQUESTED", NotificationTemplates.WITHDRAW_REQUESTED({ userName, amountCents: payload.amountCents }));
  }

  private async handleAffiliateCreated(payload: AffiliateStatusEventPayload): Promise<void> {
    await this.dispatchToAdmins("AFFILIATE_REQUESTED", NotificationTemplates.AFFILIATE_REQUESTED());

    if (payload.managerId) {
      const managerUserId = await this.recipients.resolveManagerUserIdByManagerId(payload.managerId);
      if (managerUserId) {
        await this.dispatchToUser(managerUserId, "MANAGER_NETWORK_AFFILIATE_REQUESTED", NotificationTemplates.MANAGER_NETWORK_AFFILIATE_REQUESTED());
      }
    }
  }

  private async handleGatewayUnavailable(payload: GatewayHealthEventPayload): Promise<void> {
    const message = `Gateway ${payload.provider} está ${payload.status}`;
    await this.dispatchToAdmins("SYSTEM_CRITICAL_ALERT", NotificationTemplates.SYSTEM_CRITICAL_ALERT({ message }));
  }

  /**
   * "Enviar Notificação de Teste" button — the only caller is
   * handleSendTestNotification (notifications-admin.controller.ts), never a
   * domain event. Reuses dispatchToUser exactly like every other category:
   * same preference check, same ACTIVE-subscription fan-out, same log +
   * queue write, same Provider on the worker side. Only ever targets the
   * given userId's own subscriptions — never dispatchToAdmins, never a
   * broadcast to every device on the platform.
   */
  async sendTestNotification(userId: string): Promise<void> {
    await this.dispatchToUser(userId, "TEST", NotificationTemplates.TEST());
  }

  // ---------------------------------------------------------------- fan-out

  private async dispatchToAdmins(category: NotificationCategory, template: NotificationTemplateResult): Promise<void> {
    const adminUserIds = await this.recipients.listAdminUserIds();
    await Promise.all(adminUserIds.map((userId) => this.dispatchToUser(userId, category, template)));
  }

  /** Preference check + one PushNotificationLog row + one enqueued job per ACTIVE subscription of `userId`. */
  private async dispatchToUser(userId: string, category: NotificationCategory, template: NotificationTemplateResult): Promise<void> {
    const preference = await this.preferences.find(userId, category);
    if (preference && !preference.enabled) return; // explicit opt-out; absence of a row means enabled (the default)

    const activeSubscriptions = await this.subscriptions.findActiveByUserId(userId);
    for (const subscription of activeSubscriptions) {
      const log = await this.logs.create({
        subscriptionId: subscription.id,
        userId,
        category,
        title: template.title,
        body: template.body,
        deepLink: template.deepLink,
      });

      await this.queue.add(category, {
        subscriptionId: subscription.id,
        payload: {
          title: template.title,
          body: template.body,
          icon: template.icon,
          deepLink: template.deepLink,
          priority: template.priority,
          category,
          logId: log.id,
        },
      });
    }
  }
}
