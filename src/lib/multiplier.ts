/**
 * Multiplier curve: platforms passed -> payout multiplier.
 * Anchors are interpolated in log-space for a smooth exponential feel.
 * Values beyond the last anchor extrapolate using the final segment's growth rate.
 */
export const MULTIPLIER_ANCHORS: [platforms: number, multiplier: number][] = [
  [0, 1],
  [1, 1.05],
  [2, 1.1],
  [3, 1.2],
  [5, 1.4],
  [8, 2],
  [15, 5],
  [25, 10],
  [50, 25],
  [100, 50],
];

export const MAX_PLATFORMS = 160;

export function getMultiplierForPlatforms(platforms: number): number {
  const n = Math.max(0, Math.min(platforms, MAX_PLATFORMS));
  const anchors = MULTIPLIER_ANCHORS;

  if (n <= anchors[0][0]) return anchors[0][1];

  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    if (n >= x0 && n <= x1) {
      const t = (n - x0) / (x1 - x0);
      const logY = Math.log(y0) + (Math.log(y1) - Math.log(y0)) * t;
      return Math.exp(logY);
    }
  }

  // Extrapolate past the last anchor using the last segment's growth rate
  const [xPrev, yPrev] = anchors[anchors.length - 2];
  const [xLast, yLast] = anchors[anchors.length - 1];
  const rate = Math.log(yLast / yPrev) / (xLast - xPrev);
  return Math.exp(Math.log(yLast) + rate * (n - xLast));
}

export function roundToCents(reais: number) {
  return Math.round(reais * 100);
}

export function centsToReais(cents: number) {
  return cents / 100;
}

/** Current "valor atual" (reais) for a match in progress — bet × live multiplier. Single source of truth: game-hud.tsx and the in-canvas gain indicator (game-engine/components/ball.tsx) both call this instead of each re-deriving the same product. */
export function currentValueReais(betAmountCents: number, multiplier: number) {
  return centsToReais(betAmountCents) * multiplier;
}
