"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "helijump:deposit-promo-deadline";

interface StoredDeadline {
  deadline: number; // epoch ms
  durationSeconds: number;
}

/**
 * Countdown rule (explicit, per product requirement — "não deixar a
 * contagem cancelar ou desaparecer de forma arbitrária durante a sessão"):
 *
 * The deadline is an epoch timestamp persisted in localStorage, anchored the
 * FIRST time this hook runs with a given `durationSeconds`. Every later
 * mount (navigating away and back, re-rendering, reopening the browser)
 * reads that same stored deadline and keeps counting down from it — it
 * never resets just because the component remounted. A fresh deadline is
 * only computed when: this is the first time ever, the previous deadline
 * already passed (the promo naturally expired), or the admin changed
 * `depositPromoDurationSeconds` (a real config change, not arbitrary). Once
 * expired mid-view, it holds at 0 rather than silently jumping back up —
 * the next fresh deadline only starts on a later visit.
 */
export function useDepositPromoCountdown(durationSeconds: number | null): { secondsLeft: number; expired: boolean } {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!durationSeconds || durationSeconds <= 0) return;

    let deadline: number;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const stored: StoredDeadline | null = raw ? JSON.parse(raw) : null;
      const now = Date.now();
      if (stored && stored.durationSeconds === durationSeconds && stored.deadline > now) {
        deadline = stored.deadline;
      } else {
        deadline = now + durationSeconds * 1000;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ deadline, durationSeconds } satisfies StoredDeadline));
      }
    } catch {
      // localStorage unavailable (private mode, SSR edge case) — fall back to a
      // fresh in-memory countdown for this view only, never crash the page.
      deadline = Date.now() + durationSeconds * 1000;
    }

    const tick = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [durationSeconds]);

  return { secondsLeft, expired: secondsLeft <= 0 };
}
