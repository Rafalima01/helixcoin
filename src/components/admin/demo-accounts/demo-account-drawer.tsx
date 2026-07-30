"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PlusCircle, Ban } from "lucide-react";
import { Drawer, DetailRow, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DemoAccountsAdminApi, ApiError } from "@/lib/admin/demo-accounts-api";
import { formatCurrency } from "@/lib/utils";
import type { DemoAccountListItemDto } from "@/modules/demo-accounts/dto/demo-account.dto";

const STATUS: Record<string, { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Ativa", tone: "success" },
  BLOCKED: { label: "Desativada", tone: "danger" },
  SUSPENDED: { label: "Suspensa", tone: "warning" },
  PENDING: { label: "Pendente", tone: "neutral" },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function DemoAccountDrawer({
  account,
  onClose,
}: {
  account: DemoAccountListItemDto | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [addAmount, setAddAmount] = useState("100,00");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "demo-accounts", "list"] });

  const addBalance = useMutation({
    mutationFn: () => DemoAccountsAdminApi.addBalance(account!.id, reaisToCents(addAmount)),
    onSuccess: () => {
      toast.success("Saldo adicionado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao adicionar saldo"),
  });

  const zeroBalance = useMutation({
    mutationFn: () => DemoAccountsAdminApi.zeroBalance(account!.id),
    onSuccess: () => {
      toast.success("Saldo zerado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao zerar saldo"),
  });

  const deactivate = useMutation({
    mutationFn: () => DemoAccountsAdminApi.deactivate(account!.id),
    onSuccess: () => {
      toast.success("Conta demo desativada");
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao desativar conta"),
  });

  if (!account) return null;
  const status = STATUS[account.status] ?? STATUS.PENDING;

  return (
    <Drawer open={!!account} onClose={onClose} title={account.login}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Status</span>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>

        <div className="rounded-xl border border-border p-4 flex flex-col gap-2">
          <DetailRow label="Saldo Demo" value={formatCurrency(account.balanceCents / 100)} />
          <DetailRow label="Data de criação" value={formatDateTime(account.createdAt)} />
          <DetailRow label="Último login" value={formatDateTime(account.lastLoginAt)} />
          <DetailRow label="Última atividade" value={formatDateTime(account.lastActivityAt)} />
        </div>

        {account.status !== "BLOCKED" && (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">Adicionar Saldo</p>
            <div className="flex items-center gap-2">
              <Input value={addAmount} onChange={(e) => setAddAmount(e.target.value)} placeholder="100,00" />
              <Button variant="success" size="sm" loading={addBalance.isPending} onClick={() => addBalance.mutate()}>
                <PlusCircle className="size-4" /> Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[100_00, 500_00, 1000_00].map((cents) => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => setAddAmount((cents / 100).toFixed(2).replace(".", ","))}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-purple/50 hover:text-white transition-colors"
                >
                  +{formatCurrency(cents / 100)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            loading={zeroBalance.isPending}
            disabled={account.status === "BLOCKED" || account.balanceCents === 0}
            onClick={() => zeroBalance.mutate()}
          >
            Zerar saldo
          </Button>
          <Button
            variant="danger"
            loading={deactivate.isPending}
            disabled={account.status === "BLOCKED"}
            onClick={() => deactivate.mutate()}
          >
            <Ban className="size-4" /> Desativar conta
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function reaisToCents(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Math.round(Number(normalized) * 100);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
