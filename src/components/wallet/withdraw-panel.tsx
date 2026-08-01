"use client";

import { useState } from "react";
import { ArrowUpRightIcon as ArrowUpRight } from "@phosphor-icons/react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet, useWithdraw, usePaymentLimits } from "@/hooks/use-wallet";
import { formatCurrency } from "@/lib/utils";
import { centsToReais } from "@/lib/multiplier";

const PIX_KEY_TYPES = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM", label: "Chave aleatória (EVP)" },
];

const FALLBACK_MIN = 10; // used only while /api/payments/limits is still loading

export function WithdrawPanel() {
  const [amount, setAmount] = useState<number | "">("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const { data } = useWallet();
  const { data: limits } = usePaymentLimits();
  const withdraw = useWithdraw();

  const balance = data?.balance ?? 0;
  const balanceReais = centsToReais(balance);
  const withdrawMin = limits?.withdrawMin ?? FALLBACK_MIN;
  const withdrawMax = limits?.withdrawMax;

  const handleSubmit = async () => {
    if (!amount || amount < withdrawMin) {
      toast.error(`Valor mínimo de ${formatCurrency(withdrawMin)}`);
      return;
    }
    if (withdrawMax && amount > withdrawMax) {
      toast.error(`Valor máximo por saque: ${formatCurrency(withdrawMax)}`);
      return;
    }
    if (amount > balanceReais) {
      toast.error("Saldo insuficiente");
      return;
    }
    if (pixKey.trim().length < 3) {
      toast.error("Informe uma chave PIX válida");
      return;
    }
    try {
      const result = await withdraw.mutateAsync({ amount, pixKey, pixKeyType });
      toast.success(
        result.status === "PENDING"
          ? `Saque de ${formatCurrency(amount)} solicitado — aguardando aprovação.`
          : `Saque de ${formatCurrency(amount)} solicitado!`
      );
      setAmount("");
      setPixKey("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar saque");
    }
  };

  return (
    <Card glow="purple" className="p-6 md:p-8">
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-border bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-text-secondary">Saldo disponível</span>
          <span className="font-bold text-green">{formatCurrency(balanceReais)}</span>
        </div>

        <Input
          label="Valor do saque"
          type="number"
          min={withdrawMin}
          max={withdrawMax}
          step="0.01"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
          hint={`Valor mínimo de ${formatCurrency(withdrawMin)}${withdrawMax ? ` · máximo de ${formatCurrency(withdrawMax)}` : ""}`}
        />

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-sm font-medium text-text-secondary">Tipo de chave PIX</label>
          <select
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value)}
            className="w-full h-12 rounded-2xl bg-white/[0.03] border border-border px-4 text-[15px] text-text outline-none transition-all duration-200 focus:border-purple/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
          >
            {PIX_KEY_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-[#0B0815]">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Chave PIX"
          placeholder="CPF, email, telefone ou aleatória"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
        />

        <Button
          variant="gold"
          size="lg"
          loading={withdraw.isPending}
          onClick={handleSubmit}
          disabled={balance === 0}
        >
          <ArrowUpRight className="size-5" weight="duotone" />
          Confirmar Saque
        </Button>
        {balance === 0 && (
          <p className="text-xs text-warning text-center -mt-2">
            Você ainda não possui saldo disponível para saque.
          </p>
        )}
        <p className="text-[11px] text-text-muted text-center -mt-2">
          O valor fica bloqueado até a aprovação do saque.
        </p>
      </div>
    </Card>
  );
}
