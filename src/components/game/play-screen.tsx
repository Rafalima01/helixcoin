"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { GameEngine } from "@/game-engine/game-engine";
import { GameHud } from "@/components/game/game-hud";
import { VictoryOverlay } from "@/components/game/victory-overlay";
import { DefeatOverlay } from "@/components/game/defeat-overlay";
import { useBetStore } from "@/store/bet-store";
import { useGameStore } from "@/store/game-store";
import { useStartMatch, useResolveMatch, useBeginMatch, useReportMatchProgress } from "@/hooks/use-match";
import { formatCurrency } from "@/lib/utils";

/** How often the client checkpoints aggregate telemetry to the backend while a match is live. */
const PROGRESS_REPORT_INTERVAL_MS = 5000;

export function PlayScreen() {
  const router = useRouter();
  const betAmount = useBetStore((s) => s.amount);
  const gameStatus = useGameStore((s) => s.status);
  const startMatch = useStartMatch();
  const resolveMatch = useResolveMatch();
  const beginMatch = useBeginMatch();
  const reportProgress = useReportMatchProgress();
  const [seed, setSeed] = useState<string | null>(null);
  const [engineParams, setEngineParams] = useState<Record<string, number | boolean> | undefined>(undefined);
  const [startError, setStartError] = useState<string | null>(null);
  const began = useRef(false);

  // `mutateAsync` (not `.mutate(vars, { onSuccess, onError })`) deliberately,
  // and `seed`/`startError` (not `startMatch.isPending`/`.isError`) drive the
  // render below — the mutation object's own reactive flags can get stuck
  // mid-transition here (StrictMode's dev-only double-invoke tears down and
  // recreates this effect's subscriptions between its two passes, and the
  // mutation observer's state doesn't reliably settle across that). Awaiting
  // the promise directly and tracking success/failure in local state isn't
  // affected by that, since neither depends on the observer's lifecycle.
  const startNewMatch = useCallback(async () => {
    setSeed(null);
    setEngineParams(undefined);
    setStartError(null);
    useGameStore.getState().reset();
    try {
      const data = await startMatch.mutateAsync(betAmount);
      useGameStore
        .getState()
        .startMatch(data.matchId, data.token, data.betAmount, data.targetMultiplier, data.goalAmount);
      setEngineParams(data.engineParams);
      setSeed(data.seed);
      // AWAITING_START → IN_PROGRESS — deliberately not awaited, doesn't block render.
      beginMatch.mutate({ matchId: data.matchId, token: data.token });
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Não foi possível iniciar a partida.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betAmount, startMatch]);

  useEffect(() => {
    // Guard against React StrictMode's double effect invocation in dev —
    // each extra call debits a real bet and leaks an ACTIVE match.
    if (began.current) return;
    began.current = true;
    startNewMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic aggregate telemetry checkpoint while the match is live.
  useEffect(() => {
    if (gameStatus !== "playing") return;
    const interval = window.setInterval(() => {
      const { matchId, matchToken, platformsPassed, collisionCount, maxCombo, maxVerticalSpeed } =
        useGameStore.getState();
      if (!matchId || !matchToken) return;
      reportProgress.mutate({
        matchId,
        token: matchToken,
        platformsPassed,
        collisionCount,
        longestStreak: maxCombo,
        maxVerticalSpeed,
      });
    }, PROGRESS_REPORT_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus]);

  const handleDeath = useCallback(
    (platformsPassed: number) => {
      const { matchId, matchToken, collisionCount, maxCombo, maxVerticalSpeed } = useGameStore.getState();
      if (!matchId || !matchToken) return;
      resolveMatch.mutate({
        matchId,
        token: matchToken,
        action: "loss",
        platformsPassed,
        collisionCount,
        longestStreak: maxCombo,
        maxVerticalSpeed,
      });
    },
    [resolveMatch]
  );

  const handleCashout = () => {
    const { matchId, matchToken, platformsPassed, goalReached, collisionCount, maxCombo, maxVerticalSpeed } =
      useGameStore.getState();
    // The server enforces this too — the guard just avoids a pointless request.
    if (!matchId || !matchToken || !goalReached) return;
    useGameStore.getState().setResolving();
    resolveMatch.mutate(
      {
        matchId,
        token: matchToken,
        action: "cashout",
        platformsPassed,
        collisionCount,
        longestStreak: maxCombo,
        maxVerticalSpeed,
      },
      {
        onSuccess: (data) => {
          useGameStore.getState().resolveWon(data.payout, data.multiplier);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erro ao resgatar");
          useGameStore.setState({ status: "playing" });
        },
      }
    );
  };

  const handlePlayAgain = () => {
    startNewMatch();
  };

  if (startError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-app-radial px-6 text-center">
        <AlertTriangle className="size-10 text-error" />
        <p className="text-text-secondary max-w-xs">{startError}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push("/home")}>
            Voltar
          </Button>
          <Button variant="primary" onClick={startNewMatch}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!seed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-app-radial">
        <Loader2 className="size-10 text-purple animate-spin" />
        <p className="text-text-secondary">
          Preparando sua partida de {formatCurrency(betAmount)}...
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <GameEngine key={seed} seed={seed} engineParams={engineParams} onDeath={handleDeath} />
      <GameHud
        onCashout={handleCashout}
        cashoutLoading={resolveMatch.isPending && gameStatus === "resolving"}
      />
      {gameStatus === "won" && <VictoryOverlay onPlayAgain={handlePlayAgain} />}
      {gameStatus === "lost" && <DefeatOverlay onTryAgain={handlePlayAgain} />}
    </div>
  );
}
