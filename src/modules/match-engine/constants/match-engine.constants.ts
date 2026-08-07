/** Bumped whenever the gameplay-affecting shape of engineParams or the resolve contract changes — stored on every Match for forensic/support purposes. */
export const ENGINE_VERSION = "1.0.0";

/** Float noise absorber when comparing a client-reported multiplier progression against the server-recomputed curve. */
export const MULTIPLIER_EPSILON = 1e-9;

/**
 * What happens to a bet when Anti-Cheat invalidates a match. A single named
 * constant, not an admin-editable field — Fase 4 deliberately trimmed the
 * RTP panel to 9 essential knobs and a per-policy admin control wasn't
 * requested. This is the intended extension point if that changes later
 * (e.g. a "forfeit_all" policy for confirmed cheating vs. "refund_bet_only"
 * for borderline/ambiguous flags).
 */
export const ANTI_CHEAT_INVALIDATION_POLICY = "refund_bet_only" as const;

/**
 * Flat allowance (platforms), added on top of the per-interval rate cap, when
 * MatchEngineService computes its own canonical/authoritative progress value
 * from a client-reported `platformsPassed` claim (see
 * `MatchEngineService.computeCanonicalProgress`). Absorbs ordinary
 * checkpoint-to-checkpoint timing noise (DB round-trip between the previous
 * write and this read, brief network jitter) without meaningfully affecting
 * the payout ceiling it exists to enforce — the server never lets a claim
 * through the clamp based on wall-clock time it didn't actually measure.
 */
export const CANONICAL_PROGRESS_GRACE = 2;
