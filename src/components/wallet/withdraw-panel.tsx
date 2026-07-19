"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet, useWithdraw } from "@/hooks/use-wallet";
import { formatCurrency } from "@/lib/utils";
import { centsToReais } from "@/lib/multiplier";

export function WithdrawPanel() {
  const [amount, setAmount] = useState<number | "">("");
  const [pixKey, setPixKey] = useState("");
  const { data } = useWallet();
  const withdraw = useWithdraw();

  const balance = data?.balance ?? 0;
  const balanceReais = centsToReais(balance);

  const handleSubmit = async () => {
    if (!amount || amount < 10) {
      toast.error("Valor mínimo de R$ 10,00");
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
      await withdraw.mutateAsync({ amount, pixKey });
      toast.success(`Saque de ${formatCurrency(amount)} solicitado!`);
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
          min={10}
          step="0.01"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
          hint="Valor mínimo de R$ 10,00"
        />

        <Input
          label="Chave PIX"
          placeholder="CPF, email, telefone ou aleatória"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
        />

        <Button
          variant="primary"
          size="lg"
          loading={withdraw.isPending}
          onClick={handleSubmit}
          disabled={balance === 0}
        >
          <ArrowUpRight className="size-5" />
          Confirmar Saque
        </Button>
        {balance === 0 && (
          <p className="text-xs text-warning text-center -mt-2">
            Você ainda não possui saldo disponível para saque.
          </p>
        )}
      </div>
    </Card>
  );
}
