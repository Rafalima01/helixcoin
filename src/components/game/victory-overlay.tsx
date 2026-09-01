"use client";

import { useRouter } from "next/navigation";
import { ResultCard } from "@/components/game/ResultCard";
import { useGameStore } from "@/store/game-store";
import { useWallet } from "@/hooks/use-wallet";
import { centsToReais } from "@/lib/multiplier";

/**
 * Same external prop contract as before this swapped to the Lovable
 * "Result Reveal" visual (see src/components/game/ResultCard.tsx) — only the
 * presentation changed, play-screen.tsx needed zero edits. All real data
 * still comes straight from useGameStore(); `newBalance` reuses the existing
 * read-only useWallet() query (already used elsewhere, e.g. src/components/home/bet-panel.tsx)
 * rather than being invented — the Lovable design's "Novo saldo" field has
 * no equivalent in the old overlay, and this is the one real source for it.
 */
export function VictoryOverlay({ onPlayAgain }: { onPlayAgain: () => void }) {
  const router = useRouter();
  const { payoutCents, multiplier, betAmountCents } = useGameStore();
  const { data: wallet } = useWallet();

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-4">
      <ResultCard
        won
        cashedOut
        prizeAmount={centsToReais(payoutCents)}
        newBalance={centsToReais(wallet?.balance ?? 0)}
        betAmount={centsToReais(betAmountCents)}
        multiplier={Number(multiplier.toFixed(2))}
        onPlayAgain={onPlayAgain}
        onExit={() => router.push("/home")}
      />
    </div>
  );
}
