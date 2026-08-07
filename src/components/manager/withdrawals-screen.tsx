"use client";

import { useState } from "react";
import { Wallet, HandCoins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/admin/ui";
import { PixKeyWithdrawModal } from "@/components/commercial/pix-key-withdraw-modal";
import { ListRow } from "@/components/backoffice/list-row";
import { useWallet } from "@/hooks/use-wallet";
import { useCommercialWithdrawals } from "@/hooks/use-commercial-withdrawals";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendente", className: "bg-warning/15 text-warning border-warning/25" },
  APPROVED: { label: "Aprovado", className: "bg-green/15 text-green border-green/25" },
  REJECTED: { label: "Rejeitado", className: "bg-error/15 text-error border-error/25" },
  CANCELLED: { label: "Cancelado", className: "bg-white/[0.06] text-text-secondary border-border" },
};

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

export function ManagerWithdrawalsScreen() {
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: withdrawals, isLoading: withdrawalsLoading } = useCommercialWithdrawals("MANAGER");
  const [modalOpen, setModalOpen] = useState(false);

  const availableCents = wallet?.balance ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Saq<span className="text-gradient-brand">ues</span>
        </h1>
        <p className="text-text-secondary mt-2">
          Solicite o resgate das suas comissões — todo saque é analisado por um administrador antes da liberação.
        </p>
      </div>

      <Card variant="hero-number" className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple">
            <Wallet className="size-5" />
          </span>
          <div>
            <p className="text-xs text-text-secondary">Saldo disponível para saque</p>
            {walletLoading ? (
              <Skeleton className="h-8 w-28 mt-1" />
            ) : (
              <p className="font-display text-2xl font-extrabold tabular-nums">
                <AnimatedNumber value={centsToReais(availableCents)} format={formatCurrency} />
              </p>
            )}
          </div>
        </div>

        <Button variant="gold" size="lg" className="w-full" disabled={availableCents <= 0} onClick={() => setModalOpen(true)}>
          <HandCoins className="size-4" /> Solicitar Saque
        </Button>
        {availableCents <= 0 && (
          <p className="text-[11px] text-text-muted text-center -mt-3">Você ainda não tem saldo disponível para saque.</p>
        )}
      </Card>

      <div>
        <h2 className="font-bold text-lg mb-3">Histórico</h2>
        {withdrawalsLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (withdrawals ?? []).length === 0 ? (
          <EmptyState title="Nenhum saque solicitado ainda." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {(withdrawals ?? []).map((w) => (
              <ListRow
                key={w.id}
                title={formatCurrency(w.amountCents / 100)}
                titleClassName="text-base font-bold tabular-nums"
                subtitle={
                  <>
                    Solicitado em {formatDate(w.requestedAt)} · <code>{w.pixKeyMasked}</code>
                  </>
                }
                meta={
                  (w.processedAt || w.rejectionReason) && (
                    <>
                      {w.processedAt && <p>Processado em {formatDate(w.processedAt)}</p>}
                      {w.rejectionReason && <p className="text-error">Motivo: {w.rejectionReason}</p>}
                    </>
                  )
                }
                trailing={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                      STATUS[w.status]?.className ?? "bg-white/[0.06] text-text-secondary border-border"
                    )}
                  >
                    {STATUS[w.status]?.label ?? w.status}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </div>

      <PixKeyWithdrawModal open={modalOpen} onClose={() => setModalOpen(false)} role="MANAGER" />
    </div>
  );
}
