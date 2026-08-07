import { NotFoundError, BusinessRuleError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { NotificationService, NOTIFICATION_TYPES } from "@/server/notifications";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";
import { PAYMENT_EVENTS, type DepositEventPayload } from "@/modules/payments/events/payments.events";
import { AFFILIATE_EVENTS } from "@/modules/affiliate/events/affiliate.events";
import { AFFILIATE_IDEMPOTENCY_KEYS, MAX_COMMISSION_LEVEL } from "@/modules/affiliate/constants/affiliate.constants";
import type { ICommissionRepository } from "@/modules/affiliate/interfaces/commission-repository.interface";
import type { IAffiliateRepository } from "@/modules/affiliate/interfaces/affiliate-repository.interface";
import type { IAffiliateSettingsRepository } from "@/modules/affiliate/interfaces/affiliate-settings-repository.interface";
import type { IUserReferralRepository } from "@/modules/affiliate/interfaces/user-referral-repository.interface";
// Own instance, not src/modules/manager/container.ts's — see
// affiliate.service.ts's doc comment on the same import for why.
import type { IManagerRepository } from "@/modules/manager/interfaces/manager-repository.interface";
import type { Commission } from "@/modules/affiliate/entities/affiliate.entity";

const SYSTEM_ACTOR: WalletActor = { actorId: null, actorType: "SYSTEM" };

/**
 * The commission engine. Subscribes to the EXISTING
 * PAYMENT_EVENTS.depositConfirmed (src/modules/payments, zero changes
 * there) — never polls, never touches the payments module directly.
 *
 * Walks the EXISTING User.referredById chain (no separate affiliate tree —
 * see schema.prisma's Commission model doc comment) up to
 * MAX_COMMISSION_LEVEL hops from the depositing player. At each hop, if
 * that specific ancestor has an AffiliateProfile with status APPROVED, they
 * earn that level's percentage of the deposit — non-affiliate ancestors in
 * between are simply skipped for their hop, never treated as breaking the
 * chain.
 *
 * Level 1 additionally carries the "Refinamento Fase 8" spread model (see
 * AGENTS.md, decisions A/B/E) — Managers are never a second tree, they're
 * detected at this same level-1 hop:
 *  - Ancestor has NO AffiliateProfile but IS a Manager (their own
 *    "Link da Plataforma", /r/{referralCode}, captured this player directly)
 *    → the Manager earns their full commissionPercent ceiling, as a
 *    MANAGER_SPREAD row with no affiliateId.
 *  - Ancestor IS an approved Affiliate who belongs to a Manager → the
 *    Affiliate earns their own percent as usual (REVSHARE_DEPOSIT), and the
 *    Manager additionally earns the remainder up to their ceiling
 *    (`max(0, ceilingPercent - affiliatePercent)`), also as a
 *    MANAGER_SPREAD row. Levels 2/3 never carry this — the spread is
 *    strictly a level-1 concept (see decision B).
 * All of this math runs exclusively here, server-side — never trust a
 * frontend-supplied percentage anywhere in this flow.
 */
export class CommissionService {
  constructor(
    private readonly commissions: ICommissionRepository,
    private readonly affiliates: IAffiliateRepository,
    private readonly settingsRepo: IAffiliateSettingsRepository,
    private readonly walletService: WalletService,
    private readonly userReferrals: IUserReferralRepository,
    private readonly managers: IManagerRepository
  ) {}

  /** Wired once at container-construction time (see container.ts) — not called directly in application code. */
  subscribeToDeposits(): () => void {
    return eventBus.subscribe<DepositEventPayload>(PAYMENT_EVENTS.depositConfirmed, async (event) => {
      await this.handleDepositConfirmed(event.payload);
    });
  }

  async handleDepositConfirmed(payload: DepositEventPayload): Promise<void> {
    const settings = await this.settingsRepo.get();
    const ancestorIds = await this.walkReferredByChain(payload.userId, MAX_COMMISSION_LEVEL);

    const levelPercents = [settings.revShareLevel1Percent, settings.revShareLevel2Percent, settings.revShareLevel3Percent];

    for (let i = 0; i < ancestorIds.length; i++) {
      const level = i + 1;
      const ancestorUserId = ancestorIds[i];
      const affiliate = await this.affiliates.findByUserId(ancestorUserId);

      if (!affiliate || affiliate.status !== "APPROVED") {
        // No active affiliate at this hop — at level 1 only, the ancestor
        // may instead be a Manager receiving direct-link traffic on their
        // own "Meu Link da Plataforma" (see class doc comment, decision A).
        if (level === 1) {
          await this.generateManagerSpreadForOwnLink(ancestorUserId, payload, settings);
        }
        continue;
      }

      const percent = affiliate.revShareOverridePercent ?? levelPercents[i];
      const amountCents = Math.round(payload.amountCents * percent);
      if (amountCents > 0) {
        await this.generate({
          payeeUserId: ancestorUserId,
          affiliateId: affiliate.id,
          managerId: affiliate.managerId,
          level,
          originUserId: payload.userId,
          sourceType: "REVSHARE_DEPOSIT",
          triggerId: payload.depositId,
          amountCents,
          percentApplied: percent,
          settings,
        });
      }

      if (level === 1 && affiliate.managerId) {
        await this.generateManagerSpreadForAffiliate(affiliate.managerId, affiliate.id, percent, payload, settings);
      }
    }
  }

  /** Ancestor has no AffiliateProfile — only pays if they're a Manager (their own platform link captured this player directly). Full ceiling, level 1 only. */
  private async generateManagerSpreadForOwnLink(
    ancestorUserId: string,
    payload: DepositEventPayload,
    settings: { autoApproveCommissions: boolean }
  ): Promise<void> {
    const manager = await this.managers.findByUserId(ancestorUserId);
    if (!manager) return;

    const ceilingFraction = manager.commissionPercent / 100;
    const amountCents = Math.round(payload.amountCents * ceilingFraction);
    if (amountCents <= 0) return;

    await this.generate({
      payeeUserId: manager.userId,
      affiliateId: null,
      managerId: manager.id,
      level: 1,
      originUserId: payload.userId,
      sourceType: "MANAGER_SPREAD",
      triggerId: payload.depositId,
      amountCents,
      percentApplied: ceilingFraction,
      settings,
    });
  }

  /**
   * The affiliate at level 1 belongs to a Manager — the Manager earns the
   * remainder up to their ceiling, on top of what the affiliate just earned.
   * `affiliateId` tags this MANAGER_SPREAD row with the affiliate that
   * triggered it (previously always null here) — lets "Minha Rede" compute
   * "quanto ficou para o gerente" per affiliate without a schema change,
   * since Commission.affiliateId was always nullable for exactly this case.
   */
  private async generateManagerSpreadForAffiliate(
    managerId: string,
    affiliateId: string,
    affiliatePercent: number,
    payload: DepositEventPayload,
    settings: { autoApproveCommissions: boolean }
  ): Promise<void> {
    const manager = await this.managers.findById(managerId);
    if (!manager) return;

    const ceilingFraction = manager.commissionPercent / 100;
    const spreadFraction = Math.max(0, ceilingFraction - affiliatePercent);
    const spreadCents = Math.round(payload.amountCents * spreadFraction);
    if (spreadCents <= 0) return;

    await this.generate({
      payeeUserId: manager.userId,
      affiliateId,
      managerId: manager.id,
      level: 1,
      originUserId: payload.userId,
      sourceType: "MANAGER_SPREAD",
      triggerId: payload.depositId,
      amountCents: spreadCents,
      percentApplied: spreadFraction,
      settings,
    });
  }

  /** Walks User.referredById up to `maxLevels` hops, returning ancestor userIds in order [level1, level2, level3]. */
  private async walkReferredByChain(userId: string, maxLevels: number): Promise<string[]> {
    const chain: string[] = [];
    let currentId = userId;
    for (let i = 0; i < maxLevels; i++) {
      const referredById = await this.userReferrals.findReferredById(currentId);
      if (!referredById) break;
      chain.push(referredById);
      currentId = referredById;
    }
    return chain;
  }

  private async generate(input: {
    payeeUserId: string;
    /** Null for a MANAGER_SPREAD row with no affiliate in the path. */
    affiliateId: string | null;
    managerId: string | null;
    level: number;
    originUserId: string;
    /**
     * CPA_FTD is intentionally absent: the platform is percentage-only, so no
     * new CPA row is ever generated. The enum value still exists in the schema
     * because historical Commission rows carry it — see the CommissionSourceType
     * comment in prisma/schema.prisma.
     */
    sourceType: "REVSHARE_DEPOSIT" | "MANAGER_SPREAD";
    triggerId: string;
    amountCents: number;
    percentApplied: number | null;
    settings: { autoApproveCommissions: boolean };
  }): Promise<Commission | null> {
    // Defensive dedup on top of WalletService's own idempotency-key guarantee — a replayed depositConfirmed event never double-generates a Commission row either.
    const existing = await this.commissions.findByTriggerAffiliateLevel(
      input.triggerId,
      input.affiliateId,
      input.level,
      input.sourceType
    );
    if (existing) return existing;

    // WalletTransaction.idempotencyKey is globally unique, so a MANAGER_SPREAD
    // row needs its own key even when it shares (triggerId, level) with the
    // affiliate's own REVSHARE_DEPOSIT row at the same hop — different payee,
    // same deposit.
    const idempotencyKey =
      input.sourceType === "MANAGER_SPREAD"
        ? AFFILIATE_IDEMPOTENCY_KEYS.managerSpreadCredit(input.triggerId, input.level)
        : AFFILIATE_IDEMPOTENCY_KEYS.commissionCredit(input.triggerId, input.level);

    const credited = await this.walletService.credit({
      userId: input.payeeUserId,
      amountCents: input.amountCents,
      type: "COMMISSION",
      account: "LOCKED",
      origin: "affiliate",
      originId: input.triggerId,
      idempotencyKey,
      metadata: { level: input.level, originUserId: input.originUserId, sourceType: input.sourceType },
      actor: SYSTEM_ACTOR,
    });

    const commission = await this.commissions.create({
      affiliateId: input.affiliateId,
      payeeUserId: input.payeeUserId,
      managerId: input.managerId,
      level: input.level,
      originUserId: input.originUserId,
      sourceType: input.sourceType,
      triggerId: input.triggerId,
      amountCents: input.amountCents,
      percentApplied: input.percentApplied,
      status: "LOCKED",
      walletTransactionId: credited.transaction.id,
    });

    eventBus.publish(AFFILIATE_EVENTS.commissionGenerated, {
      commissionId: commission.id,
      affiliateId: commission.affiliateId,
      affiliateUserId: input.payeeUserId,
      level: commission.level,
      amountCents: commission.amountCents,
      status: commission.status,
    });

    if (input.settings.autoApproveCommissions) {
      return this.approve(commission.id);
    }

    return commission;
  }

  /** LOCKED -> AVAILABLE. Called automatically (autoApproveCommissions) or by an admin via POST /api/admin/affiliate/commissions/{id}/approve. `payeeUserId` (affiliate or manager) is read directly off the commission row — no join needed. */
  async approve(commissionId: string): Promise<Commission> {
    const commission = await this.commissions.findById(commissionId);
    if (!commission) throw new NotFoundError("Comissão");
    if (commission.status !== "LOCKED") throw new BusinessRuleError("Comissão não está bloqueada");

    const isManagerSpread = commission.sourceType === "MANAGER_SPREAD";
    const unlocked = await this.walletService.unlock({
      userId: commission.payeeUserId,
      amountCents: commission.amountCents,
      type: "COMMISSION",
      origin: "affiliate",
      originId: commission.triggerId,
      // The ":cpa" branch is legacy-only: no new CPA commission is generated
      // (percentage-only platform), but rows created before that change can
      // still be sitting in LOCKED and must unlock with the key they were
      // credited under, or the unlock silently no-ops against a stale key.
      idempotencyKey: commission.triggerId.endsWith(":cpa")
        ? AFFILIATE_IDEMPOTENCY_KEYS.legacyCpaUnlock(commission.triggerId.replace(":cpa", ""))
        : isManagerSpread
          ? AFFILIATE_IDEMPOTENCY_KEYS.managerSpreadUnlock(commission.triggerId, commission.level)
          : AFFILIATE_IDEMPOTENCY_KEYS.commissionUnlock(commission.triggerId, commission.level),
      actor: SYSTEM_ACTOR,
    });

    const updated = await this.commissions.update(commissionId, {
      status: "AVAILABLE",
      unlockWalletTransactionId: unlocked.transaction.id,
      approvedAt: new Date(),
    });

    await NotificationService.notify({
      userId: commission.payeeUserId,
      type: NOTIFICATION_TYPES.newCommission,
      title: "Comissão disponível",
      message: `Uma comissão de ${(commission.amountCents / 100).toFixed(2)} está disponível para saque.`,
    });
    eventBus.publish(AFFILIATE_EVENTS.commissionApproved, {
      commissionId: updated.id,
      affiliateId: updated.affiliateId,
      affiliateUserId: commission.payeeUserId,
      level: updated.level,
      amountCents: updated.amountCents,
      status: updated.status,
    });

    return updated;
  }

  async reject(commissionId: string, reason: string): Promise<Commission> {
    const commission = await this.commissions.findById(commissionId);
    if (!commission) throw new NotFoundError("Comissão");
    if (commission.status !== "LOCKED") throw new BusinessRuleError("Comissão não está bloqueada");

    // Reverse the LOCKED credit — debit it back out of the payee's LOCKED bucket against the same commissionPool system account.
    await this.walletService.debit({
      userId: commission.payeeUserId,
      amountCents: commission.amountCents,
      type: "COMMISSION",
      account: "LOCKED",
      origin: "affiliate",
      originId: commission.triggerId,
      // Keyed on the commission id, not just triggerId — a MANAGER_SPREAD row
      // can share (triggerId, level) with the affiliate's own row at the same
      // hop, and WalletTransaction.idempotencyKey is globally unique.
      idempotencyKey: `${commission.triggerId}:reject:${commission.id}`,
      actor: SYSTEM_ACTOR,
    });

    const updated = await this.commissions.update(commissionId, {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason,
    });

    eventBus.publish(AFFILIATE_EVENTS.commissionRejected, {
      commissionId: updated.id,
      affiliateId: updated.affiliateId,
      affiliateUserId: commission.payeeUserId,
      level: updated.level,
      amountCents: updated.amountCents,
      status: updated.status,
    });

    return updated;
  }
}
