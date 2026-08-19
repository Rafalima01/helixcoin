/**
 * Static difficulty profile for the public, no-login "Jogada Grátis" page
 * (src/app/jogada-gratis). Deliberately NOT sourced from Prisma/Postgres —
 * that page must render even when the database is unreachable, so it can't
 * depend on `gameConfigContainer.gameConfigService.getActive()` like the
 * in-platform Demo mode does.
 *
 * These values are a frozen copy of `config.modes.DEMO`'s REGISTRY DEFAULTS
 * (src/modules/game-config/constants/field-registry.ts, `MODE_FIELDS[*].defaults.DEMO`)
 * — the same numbers an admin sees pre-filled the first time they open the
 * DEMO tab at /admin/rtp, before ever touching a slider. Not invented, not a
 * separate difficulty tier: this is what DEMO already was at the moment this
 * file was written.
 *
 * Trade-off, accepted on purpose: an admin changing DEMO's sliders at
 * /admin/rtp will NOT retroactively update this file — Jogada Grátis and the
 * in-platform Demo can drift apart again. Keeping the public page independent
 * of the database was the explicit priority; real-time sync between the two
 * is a separate, later piece of work.
 */
export const FREE_ROUND_CONFIG: Record<string, number | boolean> = {
  gravity: -13,
  bounceForce: 0.66,
  ballSpeed: 13,
  rotationSpeed: 0.95,
  dangerChance: 0.45,
  maxDangerSegments: 2,
  protectedPlatforms: 8,
  totalPlatforms: 44,
  segmentsPerPlatform: 12,
  gapWidth: 3,
};

/**
 * Matches PromotionSettings.firstDepositBonusPercent's schema default
 * (prisma/schema.prisma `@default(0.5)`) — only used to word the "primeiro
 * depósito" teaser on the free-round result modal, not a financial value.
 */
export const FREE_ROUND_FIRST_DEPOSIT_BONUS_PERCENT = 0.5;
