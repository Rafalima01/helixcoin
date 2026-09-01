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
 * read-only useWallet() query, same as VictoryOverlay.
 *
 * The old defeat card's "Você atravessou N plataformas antes de cair" line
 * (platformsPassed) has no equivalent slot in the Lovable design and is
 * deliberately not force-fit into it — the underlying data still exists in
 * game-store/the backend, only this particular flavor-text UI element was
 * dropped because the new design doesn't have one.
 */
export function DefeatOverlay({ onTryAgain }: { onTryAgain: () => void }) {
  const router = useRouter();
  const { betAmountCents, multiplier } = useGameStore();
  const { data: wallet } = useWallet();

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-4">
      <ResultCard
        won={false}
        cashedOut={false}
        prizeAmount={-centsToReais(betAmountCents)}
        newBalance={centsToReais(wallet?.balance ?? 0)}
        betAmount={centsToReais(betAmountCents)}
        multiplier={Number(multiplier.toFixed(2))}
        onPlayAgain={onTryAgain}
        onExit={() => router.push("/home")}
      />
    </div>
  );
}
