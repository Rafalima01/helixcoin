/**
 * Deterministic idempotency-key scheme, parallel to payments' `deposit:{id}:confirm`
 * convention — every WalletService call CommissionService makes passes one of
 * these, so a replayed `depositConfirmed` event never double-credits.
 */
export const AFFILIATE_IDEMPOTENCY_KEYS = {
  commissionCredit: (depositId: string, level: number) => `commission:${depositId}:level${level}`,
  commissionUnlock: (depositId: string, level: number) => `commission:${depositId}:level${level}:unlock`,
  /**
   * Legacy — the platform is percentage-only and no longer generates CPA
   * commissions. Kept solely so a CPA row created before that change can still
   * be approved: the unlock must reuse the exact key its credit was written
   * under. There is deliberately no matching `cpaCredit` any more.
   */
  legacyCpaUnlock: (depositId: string) => `commission:${depositId}:cpa:unlock`,
  /** Distinct from commissionCredit/Unlock — a MANAGER_SPREAD row can exist at the same (depositId, level) as the affiliate's own REVSHARE_DEPOSIT row (different payee), and WalletTransaction.idempotencyKey is globally unique. */
  managerSpreadCredit: (depositId: string, level: number) => `commission:${depositId}:level${level}:mgrspread`,
  managerSpreadUnlock: (depositId: string, level: number) => `commission:${depositId}:level${level}:mgrspread:unlock`,
} as const;

export const DEFAULT_AFFILIATE_SETTINGS_ID = "global";

/** Max tree-hop distance the commission engine walks up User.referredById from a depositing player. */
export const MAX_COMMISSION_LEVEL = 3;
