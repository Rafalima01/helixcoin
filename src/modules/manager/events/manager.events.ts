/**
 * Manager-assignment events (an affiliate joining a manager's network) are
 * published by src/modules/affiliate (see AFFILIATE_EVENTS.managerAssigned)
 * — that module owns the actual write to AffiliateProfile.managerId, since
 * src/modules/manager depends on src/modules/affiliate and not the reverse.
 *
 * These are the Manager module's own domain events: the invite-based
 * onboarding lifecycle (see ManagerInviteService).
 */
export const MANAGER_EVENTS = {
  inviteCreated: "manager.invite.created",
  inviteRegenerated: "manager.invite.regenerated",
  inviteRevoked: "manager.invite.revoked",
  /** Account created, now sitting in the Admin's Solicitações queue (approvalStatus PENDING_REVIEW) — not yet a Manager. */
  inviteAccepted: "manager.invite.accepted",
  inviteApproved: "manager.invite.approved",
  inviteRejected: "manager.invite.rejected",
} as const;
