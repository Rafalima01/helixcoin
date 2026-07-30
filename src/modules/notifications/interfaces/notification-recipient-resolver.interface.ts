/**
 * The cross-module read side of targeting — resolving "who" for a domain
 * event, kept out of NotificationDispatcher itself so the dispatcher can be
 * unit-tested with a fake resolver instead of a real database. Prisma-backed
 * implementation reuses existing repositories (affiliate/manager modules)
 * rather than re-deriving the referredById → AffiliateProfile → Manager
 * chain the commission engine already walks.
 */
export interface INotificationRecipientResolver {
  /** Every SUPER_ADMIN/ADMIN user — the broadcast audience. */
  listAdminUserIds(): Promise<string[]>;
  /** Walks User.referredById up looking for the nearest ancestor with an AffiliateProfile; returns that affiliate's manager's userId, or null if there's no affiliate/manager in the chain. */
  resolveManagerUserIdForUser(userId: string): Promise<string | null>;
  /** Direct managerId (e.g. from AffiliateStatusEventPayload.managerId) → owning User.id. */
  resolveManagerUserIdByManagerId(managerId: string): Promise<string | null>;
  /** Best-effort display name for template copy ("Jogador João") — never throws, falls back to a generic label. */
  getUserDisplayName(userId: string): Promise<string>;
}
