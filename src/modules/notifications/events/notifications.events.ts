/**
 * This module's OWN events — observability into the dispatch pipeline
 * itself, distinct from the domain events (PAYMENT_EVENTS/AFFILIATE_EVENTS/
 * MANAGER_EVENTS) it subscribes to. Nothing subscribes to these yet, same
 * "publish now, consumers subscribe independently" convention as every
 * other *_EVENTS map in this codebase.
 */
export const NOTIFICATIONS_EVENTS = {
  pushQueued: "notifications.push.queued",
  pushSent: "notifications.push.sent",
  pushFailed: "notifications.push.failed",
  pushClicked: "notifications.push.clicked",
} as const;

export interface PushQueuedEventPayload {
  logId: string;
  userId: string;
  category: string;
}

export interface PushClickedEventPayload {
  logId: string;
  userId: string;
}

/** DailySummaryService's own generated event — published once a day (23:59), consumed by NotificationDispatcher exactly like any other domain event. */
export const DAILY_SUMMARY_EVENTS = {
  generated: "notifications.daily_summary.generated",
} as const;

export interface DailySummaryEventPayload {
  depositsTotalCents: number;
  withdrawsTotalCents: number;
  newPlayers: number;
  newAffiliates: number;
  newManagers: number;
}
