"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DemoAccountsAdminApi, ApiError } from "@/lib/admin/demo-accounts-api";
import { formatCurrency } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";
import type { DemoAccountCreatedDto } from "@/modules/demo-accounts/dto/demo-account.dto";

const QUICK_AMOUNTS = [50_00, 100_00, 250_00, 500_00, 1000_00];

export function CreateDemoAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [initialReais, setInitialReais] = useState("100,00");
  const [result, setResult] = useState<DemoAccountCreatedDto | null>(null);
  const [copiedField, setCopiedField] = useState<"phone" | "password" | "all" | null>(null);

  const create = useMutation({
    mutationFn: () => DemoAccountsAdminApi.create(reaisToCents(initialReais)),
    onSuccess: (res) => {
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ["admin", "demo-accounts", "list"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao criar conta demo"),
  });

  const handleClose = () => {
    setInitialReais("100,00");
    setResult(null);
    setCopiedField(null);
    onClose();
  };

  const copy = async (field: "phone" | "password" | "all", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={result ? "Conta Demo criada" : "Nova Conta Demo"}
      description={
        result
          ? "Guarde a senha agora — ela não será exibida novamente. Login é feito com o telefone abaixo + senha, exatamente como uma conta de jogador normal."
          : "Exclusiva para influenciadores, criadores de conteúdo e parceiros. Não conta para estatísticas financeiras."
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-black/30 p-4 flex flex-col gap-3">
            <CredentialRow
              label="Telefone (login)"
              value={formatPhone(result.phone)}
              onCopy={() => copy("phone", result.phone)}
              copied={copiedField === "phone"}
            />
            <CredentialRow label="Senha" value={result.password} onCopy={() => copy("password", result.password)} copied={copiedField === "password"} />
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-text-secondary">Saldo</span>
              <span className="font-bold tabular-nums text-green">{formatCurrency(result.balanceCents / 100)}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={() => copy("phone", result.phone)}>
              Copiar Telefone
            </Button>
            <Button variant="secondary" size="sm" onClick={() => copy("password", result.password)}>
              Copiar Senha
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                copy(
                  "all",
                  `Telefone: ${formatPhone(result.phone)} / Senha: ${result.password} / Saldo: ${formatCurrency(result.balanceCents / 100)}`
                )
              }
            >
              {copiedField === "all" ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar Tudo
            </Button>
          </div>
          <Button variant="secondary" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Input
            label="Saldo Inicial"
            value={initialReais}
            onChange={(e) => setInitialReais(e.target.value)}
            placeholder="100,00"
            hint="Não há limite máximo. Pode ser alterado depois via Adicionar Saldo."
          />
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => setInitialReais(centsToReais(cents))}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-purple/50 hover:text-white transition-colors"
              >
                {formatCurrency(cents / 100)}
              </button>
            ))}
          </div>
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
            Criar Conta Demo
          </Button>
        </div>
      )}
    </Modal>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
        <p className="font-mono text-sm font-semibold truncate">{value}</p>
      </div>
      <button
        onClick={onCopy}
        className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
        aria-label={`Copiar ${label}`}
      >
        {copied ? <Check className="size-4 text-green" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function reaisToCents(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Math.round(Number(normalized) * 100);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
