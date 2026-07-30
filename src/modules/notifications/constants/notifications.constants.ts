/**
 * Every *preference-gated* category — validators/services build off this
 * instead of re-listing the enum values by hand. Kept in sync with
 * prisma/schema.prisma's NotificationCategory, with one deliberate
 * exception: TEST (the "Enviar Notificação de Teste" button) is a real enum
 * value but never appears here, since it's not opt-out-able and has no
 * preferences-panel toggle — NotificationDispatcherService.sendTestNotification()
 * passes it straight to dispatchToUser, same as every other category.
 */
export const NOTIFICATION_CATEGORIES = [
  "DEPOSIT_CONFIRMED",
  "WITHDRAW_REQUESTED",
  "WITHDRAW_APPROVED",
  "WITHDRAW_REJECTED",
  "MANAGER_REQUESTED",
  "AFFILIATE_REQUESTED",
  "DAILY_SUMMARY",
  "SYSTEM_CRITICAL_ALERT",
  "MANAGER_NETWORK_DEPOSIT_CONFIRMED",
  "MANAGER_NETWORK_AFFILIATE_REQUESTED",
] as const;

/** Categories broadcast to every SUPER_ADMIN/ADMIN user — surfaced in the admin preferences screen. */
export const ADMIN_NOTIFICATION_CATEGORIES = [
  "DEPOSIT_CONFIRMED",
  "WITHDRAW_REQUESTED",
  "WITHDRAW_APPROVED",
  "WITHDRAW_REJECTED",
  "MANAGER_REQUESTED",
  "AFFILIATE_REQUESTED",
  "DAILY_SUMMARY",
  "SYSTEM_CRITICAL_ALERT",
] as const;

/** Categories targeted at a single manager, scoped to their own network — surfaced in the manager preferences screen. */
export const MANAGER_NOTIFICATION_CATEGORIES = ["MANAGER_NETWORK_DEPOSIT_CONFIRMED", "MANAGER_NETWORK_AFFILIATE_REQUESTED"] as const;
