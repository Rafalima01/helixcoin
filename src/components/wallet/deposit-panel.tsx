"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Loader2 } from "lucide-react";
import {
  CopyIcon as Copy,
  CheckIcon as Check,
  QrCodeIcon as QrCode,
  FlameIcon as Flame,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PixQr } from "@/components/wallet/pix-qr";
import { DepositPromoBanner } from "@/components/wallet/deposit-promo-banner";
import { useCreateDeposit, useSimulateDepositPayment, usePaymentLimits, useDepositOffer } from "@/hooks/use-wallet";
import { formatCurrency, cn } from "@/lib/utils";

const FALLBACK_MIN = 5; // used only while /api/payments/limits is still loading
const FALLBACK_QUICK_AMOUNTS = [50, 100, 200, 500]; // used only while /api/promotions/deposit-offer is still loading

export function DepositPanel() {
  const [amount, setAmount] = useState<number | "">(100);
  const [step, setStep] = useState<"amount" | "pix">("amount");
  const [pix, setPix] = useState<{ depositId: string; pixCode: string; canSimulate: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: limits } = usePaymentLimits();
  const depositMin = limits?.depositMin ?? FALLBACK_MIN;
  const depositMax = limits?.depositMax;

  const { data: offer } = useDepositOffer();
  const quickAmounts = offer?.quickAmounts ?? FALLBACK_QUICK_AMOUNTS.map((v) => ({ amount: v, highlightEnabled: false, highlightLabel: null }));
  const secondDepositPercent = offer ? Math.round(offer.secondDepositBonusPercent * 100) : null;

  const createDeposit = useCreateDeposit();
  const simulateDeposit = useSimulateDepositPayment(pix?.depositId ?? null);

  const reset = () => {
    setStep("amount");
    setPix(null);
    setCopied(false);
    setAmount(100);
  };

  const handleGenerate = async () => {
    if (!amount || amount < depositMin) {
      toast.error(`Informe um valor válido (mín. ${formatCurrency(depositMin)})`);
      return;
    }
    if (depositMax && amount > depositMax) {
      toast.error(`Valor máximo por depósito: ${formatCurrency(depositMax)}`);
      return;
    }
    try {
      const res = await createDeposit.mutateAsync(amount);
      setPix({ depositId: res.depositId, pixCode: res.pixCode, canSimulate: res.canSimulate });
      setStep("pix");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar PIX");
    }
  };

  const handleCopy = async () => {
    if (!pix) return;
    await navigator.clipboard.writeText(pix.pixCode);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (!pix) return;
    try {
      await simulateDeposit.mutateAsync();
      // Money-in celebration — gold/green palette (financial success), distinct
      // from the purple/pink/green cannons used for game victories.
      confetti({
        particleCount: 60,
        spread: 65,
        startVelocity: 42,
        gravity: 1.1,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#FFD479", "#F0A83C", "#16F2A5"],
      });
      toast.success(`Depósito de ${formatCurrency(Number(amount))} confirmado!`);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao confirmar pagamento");
    }
  };

  return (
    <Card glow="green" className="p-6 md:p-8 overflow-hidden">
      <AnimatePresence initial={false} mode="wait">
        {step === "amount" ? (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-5"
          >
            {offer?.promoEnabled && <DepositPromoBanner durationSeconds={offer.promoDurationSeconds} />}

            {!!secondDepositPercent && secondDepositPercent > 0 && (
              <p className="text-center text-xs font-semibold text-gold">
                Garanta {secondDepositPercent}% de bônus a partir do segundo depósito
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3">
              {quickAmounts.map((q) => (
                <div key={q.amount} className="relative">
                  {q.highlightEnabled && (
                    <span className="absolute -top-2 -right-1.5 z-10 flex items-center gap-0.5 whitespace-nowrap rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#3a1e00] shadow-[0_2px_6px_rgba(240,168,60,0.55)]">
                      <Flame className="size-2.5" weight="duotone" /> {q.highlightLabel || "Quente"}
                    </span>
                  )}
                  <button
                    onClick={() => setAmount(q.amount)}
                    className={cn(
                      "h-11 w-full rounded-xl border text-sm font-semibold transition-all",
                      amount === q.amount
                        ? "border-green bg-green/15 text-green"
                        : q.highlightEnabled
                          ? "border-gold bg-gold/10 text-text hover:bg-gold/15"
                          : "border-border bg-white/[0.02] text-text-secondary hover:border-border-strong"
                    )}
                  >
                    {formatCurrency(q.amount)}
                  </button>
                </div>
              ))}
            </div>

            <Input
              label="Valor personalizado"
              type="number"
              min={depositMin}
              max={depositMax}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
              hint={`Valor mínimo de ${formatCurrency(depositMin)}${depositMax ? ` · máximo de ${formatCurrency(depositMax)}` : ""}`}
            />

            <Button
              variant="gold"
              size="lg"
              loading={createDeposit.isPending}
              onClick={handleGenerate}
            >
              <QrCode className="size-5" weight="duotone" />
              Gerar QR Code PIX
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="pix"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-5"
          >
            <PixQr data={pix?.pixCode ?? ""} />

            <p className="text-2xl font-extrabold text-gradient-green">
              {formatCurrency(Number(amount))}
            </p>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-left"
            >
              <span className="text-xs text-text-muted font-mono truncate">{pix?.pixCode}</span>
              {copied ? (
                <Check className="size-4 text-green shrink-0" weight="duotone" />
              ) : (
                <Copy className="size-4 text-text-secondary shrink-0" weight="duotone" />
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="size-3.5 animate-spin" />
              Aguardando confirmação do pagamento...
            </div>

            {pix?.canSimulate && (
              <Button
                variant="success"
                size="lg"
                loading={simulateDeposit.isPending}
                onClick={handleConfirm}
                className="w-full"
              >
                Simular Pagamento (Demo)
              </Button>
            )}
            <button
              onClick={reset}
              className="text-xs text-text-secondary hover:text-white transition-colors"
            >
              Alterar valor
            </button>
            {pix?.canSimulate ? (
              <p className="text-[11px] text-text-muted text-center -mt-2">
                Ambiente de demonstração — nenhum valor real é cobrado.
              </p>
            ) : (
              <p className="text-[11px] text-text-muted text-center -mt-2">
                Pague o PIX acima com seu banco — a confirmação é automática.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
