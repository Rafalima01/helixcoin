"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "@/game-engine/game-engine";
import { GameHud } from "@/components/game/game-hud";
import { useGameStore } from "@/store/game-store";
import { DemoResultModal } from "@/components/demo/demo-result-modal";

/**
 * Anonymous, no-auth run of the REAL game engine — same GameEngine, same
 * physics, same multiplier curve (useGameStore.registerPass already computes
 * it locally, see src/lib/multiplier.ts). The only difference from a real
 * match (src/components/game/play-screen.tsx): everything here is local
 * state, never /api/matches/* — no bet is placed, no wallet is touched.
 */
const DEMO_BET_CENTS = 10_000; // R$100 fictício, o exemplo do próprio pedido
const DEMO_TARGET_MULTIPLIER = 5; // mesmo default de useGameStore

interface DemoResult {
  multiplier: number;
  wouldHaveWonCents: number;
}

export function DemoPlayScreen({ firstDepositBonusPercent }: { firstDepositBonusPercent: number }) {
  const [seed, setSeed] = useState<string | null>(null);
  const [result, setResult] = useState<DemoResult | null>(null);
  const began = useRef(false);

  const startDemo = useCallback(() => {
    setResult(null);
    useGameStore.getState().reset();
    useGameStore
      .getState()
      .startMatch("demo-local", "demo-local", DEMO_BET_CENTS, DEMO_TARGET_MULTIPLIER, DEMO_BET_CENTS * DEMO_TARGET_MULTIPLIER);
    setSeed(crypto.randomUUID());
  }, []);

  useEffect(() => {
    // Guard against React StrictMode's double effect invocation in dev, same as play-screen.tsx.
    if (began.current) return;
    began.current = true;
    startDemo();
  }, [startDemo]);

  /** Same formula as match-engine.service.ts's real payout (Math.round(betAmount * multiplier)) — the number shown always matches what a real match would have paid. */
  const finish = useCallback((): DemoResult => {
    const { multiplier } = useGameStore.getState();
    return { multiplier, wouldHaveWonCents: Math.round(DEMO_BET_CENTS * multiplier) };
  }, []);

  const handleDeath = useCallback(() => {
    const outcome = finish();
    useGameStore.getState().resolveLost();
    setResult(outcome);
  }, [finish]);

  const handleCashout = useCallback(() => {
    if (!useGameStore.getState().goalReached) return;
    const outcome = finish();
    useGameStore.getState().resolveWon(outcome.wouldHaveWonCents, outcome.multiplier);
    setResult(outcome);
  }, [finish]);

  if (!seed) return null; // starts synchronously, no server round-trip to wait on

  return (
    <div className="absolute inset-0 overflow-hidden">
      <GameEngine key={seed} seed={seed} onDeath={handleDeath} />
      <GameHud onCashout={handleCashout} cashoutLoading={false} />
      {result && (
        <DemoResultModal
          multiplier={result.multiplier}
          wouldHaveWonCents={result.wouldHaveWonCents}
          firstDepositBonusPercent={firstDepositBonusPercent}
          onClose={startDemo}
        />
      )}
    </div>
  );
}
