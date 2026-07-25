"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  DataTable,
  FilterBar,
  Drawer,
  DetailRow,
  type TableColumn,
} from "@/components/admin/ui";
import { WalletsAdminApi, ApiError } from "@/lib/admin/wallet-api";
import type { WalletAdminSummaryDto, WalletTransactionDto } from "@/modules/wallet/dto/wallet.dto";
import { formatCurrency } from "@/lib/utils";

function formatCents(cents: number) {
  return formatCurrency(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

const TYPE_LABEL: Record<string, string> = {
  BET: "Aposta",
  BET_REFUND: "Estorno de aposta",
  PAYOUT: "Prêmio",
  DEPOSIT: "Depósito",
  DEPOSIT_PENDING: "Depósito pendente",
  DEPOSIT_FAILED: "Depósito falhou",
  WITHDRAW: "Saque",
  WITHDRAW_PENDING: "Saque pendente",
  WITHDRAW_REJECTED: "Saque rejeitado",
  WITHDRAW_APPROVED: "Saque aprovado",
  BONUS: "Bônus",
  CASHBACK: "Cashback",
  COMMISSION: "Comissão",
  ADJUSTMENT: "Ajuste manual",
  REVERSAL: "Reversão",
  SYSTEM: "Sistema",
  MANUAL: "Manual",
  TRANSFER: "Transferência",
  LOCK: "Bloqueio",
  UNLOCK: "Desbloqueio",
  EXPIRATION: "Expiração",
};

export default function AdminWalletsPage() {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "wallets", search],
    queryFn: () => WalletsAdminApi.listWallets({ search, page: 1, pageSize: 100 }),
  });

  const rows = data?.data ?? [];

  const columns: TableColumn<WalletAdminSummaryDto & { id: string }>[] = [
    {
      key: "user",
      header: "Titular",
      render: (w) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{w.userName}</p>
          <p className="text-xs text-text-muted truncate">{w.userEmail}</p>
        </div>
      ),
    },
    {
      key: "main",
      header: "Saldo Principal",
      align: "right",
      render: (w) => <span className="font-semibold tabular-nums text-green">{formatCents(w.main)}</span>,
    },
    {
      key: "locked",
      header: "Bloqueado",
      align: "right",
      render: (w) => (
        <span className="tabular-nums text-text-secondary">{w.locked > 0 ? formatCents(w.locked) : "—"}</span>
      ),
    },
    {
      key: "bonus",
      header: "Bônus",
      align: "right",
      render: (w) => (
        <span className="tabular-nums text-text-secondary">{w.bonus > 0 ? formatCents(w.bonus) : "—"}</span>
      ),
    },
    {
      key: "updated",
      header: "Atualizada",
      align: "right",
      render: (w) => <span className="text-xs text-text-muted">{formatDate(w.updatedAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Carteiras"
        description="Posição consolidada de saldos dos jogadores — dados reais via src/modules/wallet. Todo ajuste passa pelo Ledger com auditoria."
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por nome, email ou ID do usuário..." />
      <DataTable
        columns={columns}
        rows={rows.map((w) => ({ ...w, id: w.userId }))}
        loading={isLoading}
        onRowClick={(w) => setSelectedUserId(w.userId)}
        emptyMessage="Nenhuma carteira encontrada"
      />

      {selectedUserId && (
        <WalletDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}

function WalletDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [adjusting, setAdjusting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "wallet", userId],
    queryFn: () => WalletsAdminApi.getWallet(userId),
  });
  const wallet = data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "wallet", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "wallets"] });
  };

  return (
    <Drawer open onClose={onClose} title={wallet ? "Carteira" : "Carregando..."}>
      {isLoading || !wallet ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <DetailRow label="Usuário" value={<code className="text-xs">{wallet.balances.userId}</code>} />
            <DetailRow
              label="Saldo Principal"
              value={<span className="text-green font-bold">{formatCents(wallet.balances.main)}</span>}
            />
            <DetailRow label="Saldo Bloqueado" value={formatCents(wallet.balances.locked)} />
            <DetailRow label="Saldo Bônus" value={formatCents(wallet.balances.bonus)} />
            <DetailRow label="Atualizada em" value={formatDate(wallet.balances.updatedAt)} />
          </div>

          <Button variant="secondary" size="sm" onClick={() => setAdjusting(true)}>
            Ajuste manual
          </Button>

          <div>
            <p className="mb-2 text-xs font-semibold text-text-muted">Histórico recente</p>
            <div className="flex flex-col gap-2">
              {wallet.recentTransactions.length === 0 && (
                <p className="text-sm text-text-muted">Nenhuma transação registrada.</p>
              )}
              {wallet.recentTransactions.map((t) => (
                <TransactionRow key={t.id} tx={t} />
              ))}
            </div>
          </div>
        </div>
      )}

      {adjusting && (
        <AdjustDrawer
          userId={userId}
          onClose={() => setAdjusting(false)}
          onAdjusted={() => {
            setAdjusting(false);
            invalidate();
          }}
        />
      )}
    </Drawer>
  );
}

function TransactionRow({ tx }: { tx: WalletTransactionDto }) {
  const isCredit = tx.balanceAfter !== null && tx.balanceBefore !== null && tx.balanceAfter > tx.balanceBefore;
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{TYPE_LABEL[tx.type] ?? tx.type}</p>
        <span
          className={
            isCredit ? "text-sm font-semibold tabular-nums text-green" : "text-sm font-semibold tabular-nums"
          }
        >
          {isCredit ? "+" : "−"}
          {formatCents(tx.amount)}
        </span>
      </div>
      <p className="text-xs text-text-muted">
        {tx.origin} · {formatDate(tx.createdAt)}
      </p>
    </div>
  );
}

function AdjustDrawer({
  userId,
  onClose,
  onAdjusted,
}: {
  userId: string;
  onClose: () => void;
  onAdjusted: () => void;
}) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<"MAIN" | "LOCKED" | "BONUS">("MAIN");
  const [reason, setReason] = useState("");
  const [observation, setObservation] = useState("");

  const adjust = useMutation({
    mutationFn: () => {
      const amountCents = Math.round(Number(amount) * 100) * (direction === "debit" ? -1 : 1);
      return WalletsAdminApi.adjustWallet(userId, { amount: amountCents, account, reason, observation });
    },
    onSuccess: () => {
      toast.success("Ajuste aplicado");
      onAdjusted();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao ajustar carteira"),
  });

  return (
    <Drawer open onClose={onClose} title="Ajuste manual">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          adjust.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection("credit")}
            className={
              direction === "credit"
                ? "h-10 rounded-xl border border-green bg-green/15 text-sm font-semibold text-green"
                : "h-10 rounded-xl border border-border bg-white/[0.02] text-sm font-semibold text-text-secondary"
            }
          >
            Crédito
          </button>
          <button
            type="button"
            onClick={() => setDirection("debit")}
            className={
              direction === "debit"
                ? "h-10 rounded-xl border border-error bg-error/15 text-sm font-semibold text-error"
                : "h-10 rounded-xl border border-border bg-white/[0.02] text-sm font-semibold text-text-secondary"
            }
          >
            Débito
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Valor (R$)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Saldo afetado</label>
          <select
            value={account}
            onChange={(e) => setAccount(e.target.value as "MAIN" | "LOCKED" | "BONUS")}
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          >
            <option value="MAIN">Principal</option>
            <option value="LOCKED">Bloqueado</option>
            <option value="BONUS">Bônus</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Motivo</label>
          <input
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: correção de saldo"
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Observação</label>
          <textarea
            required
            minLength={3}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={3}
            placeholder="Detalhes do ajuste, ticket de suporte, etc."
            className="w-full rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-purple/60"
          />
        </div>

        <Button type="submit" variant="primary" loading={adjust.isPending}>
          Aplicar ajuste
        </Button>
        <p className="text-[11px] text-text-muted">
          Todo ajuste manual gera um lançamento no Ledger e uma linha em AuditLog (autor, motivo, IP).
        </p>
      </form>
    </Drawer>
  );
}
