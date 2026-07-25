/** Rotates the array so it starts at `startIdx % length` — the ROUND_ROBIN ordering primitive. Single-process, in-memory counter — same documented limitation as src/server/events' event bus. */
export function roundRobinOrder<T>(candidates: T[], startIdx: number): T[] {
  if (candidates.length === 0) return [];
  const idx = ((startIdx % candidates.length) + candidates.length) % candidates.length;
  return [...candidates.slice(idx), ...candidates.slice(0, idx)];
}

/** Draws candidates one at a time without replacement, each draw weighted by `.weight` — produces a full preference order (first draw = primary, rest = fallback order), not just a single pick, so WEIGHTED mode still benefits from failover. */
export function weightedOrder<T extends { weight: number }>(candidates: T[]): T[] {
  const pool = [...candidates];
  const order: T[] = [];
  while (pool.length > 0) {
    const total = pool.reduce((sum, c) => sum + Math.max(c.weight, 0), 0);
    if (total <= 0) {
      order.push(...pool);
      break;
    }
    let r = Math.random() * total;
    let pickIdx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      if (r < pool[i].weight) {
        pickIdx = i;
        break;
      }
      r -= pool[i].weight;
    }
    order.push(pool[pickIdx]);
    pool.splice(pickIdx, 1);
  }
  return order;
}
