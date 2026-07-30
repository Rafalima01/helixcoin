"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils";

export function DemoResultModal({
  multiplier,
  wouldHaveWonCents,
  firstDepositBonusPercent,
  onClose,
}: {
  multiplier: number;
  wouldHaveWonCents: number;
  /** Fraction (0.5 = 50%), always fetched fresh from PromotionSettings — never hardcoded here. */
  firstDepositBonusPercent: number;
  onClose: () => void;
}) {
  const bonusPercentLabel = Math.round(firstDepositBonusPercent * 100);

  return (
    <Modal open onClose={onClose} title="🎉 Parabéns!" description="Você acabou de experimentar o HelixCoin.">
      <div className="flex flex-col gap-5">
        <div className="glass-panel rounded-2xl border border-border p-5 text-center">
          <p className="text-sm text-text-secondary">Multiplicador alcançado</p>
          <p className="text-3xl font-extrabold text-gradient-gold">x{multiplier.toFixed(2)}</p>
          <p className="mt-3 text-sm text-text-secondary">Você teria ganho</p>
          <p className="text-2xl font-extrabold">{formatCurrency(wouldHaveWonCents / 100)}</p>
        </div>

        {bonusPercentLabel > 0 && (
          <p className="text-center text-sm text-text-secondary">
            Ganhe <span className="font-bold text-gold">{bonusPercentLabel}% de bônus</span> no seu primeiro depósito.
            Comece agora a jogar com dinheiro real.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/signup?source=demo" className="flex-1">
            <Button variant="gold" size="lg" className="w-full">
              Criar Conta
            </Button>
          </Link>
          <Link href="/login" className="flex-1">
            <Button variant="ghost" size="lg" className="w-full">
              Entrar
            </Button>
          </Link>
        </div>
      </div>
    </Modal>
  );
}
