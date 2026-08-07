"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  DataTable,
  FilterBar,
  FilterChips,
  StatusBadge,
  Drawer,
  DetailRow,
  JsonViewer,
  DrawerSkeleton,
  type TableColumn,
} from "@/components/admin/ui";
import { TransactionsAdminApi } from "@/lib/admin/wallet-api";
import type { WalletTransactionDto } from "@/modules/wallet/dto/wallet.dto";
import { formatCurrency } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "pink";

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

const STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pendente", tone: "warning" },
  COMPLETED: { label: "Concluída", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
};

const ACCOUNT_LABEL: Record<string, string> = {
  MAIN: "Principal",
  LOCKED: "Bloqueado",
  BONUS: "Bônus",
};

export default function AdminTransactionsPage() {
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "transactions", userId, type, status],
    queryFn: () => TransactionsAdminApi.listTransactions({ userId, type, status, page: 1, pageSize: 100 }),
  });

  const rows = data?.data ?? [];

  const columns: TableColumn<WalletTransactionDto>[] = useMemo(
    () => [
      {
        key: "type",
        header: "Tipo",
        render: (t) => (
          <div className="min-w-0">
            <p className="font-semibold truncate">{TYPE_LABEL[t.type] ?? t.type}</p>
            <p className="text-xs text-text-muted truncate">{ACCOUNT_LABEL[t.account] ?? t.account}</p>
          </div>
        ),
      },
      {
        key: "amount",
        header: "Valor",
        align: "right",
        render: (t) => <span className="font-semibold tabular-nums">{formatCents(t.amount)}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (t) => {
          const s = STATUS_LABEL[t.status] ?? { label: t.status, tone: "neutral" as Tone };
          return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
        },
      },
      {
        key: "origin",
        header: "Origem",
        render: (t) => <span className="text-xs text-text-secondary">{t.origin}</span>,
      },
      {
        key: "user",
        header: "Usuário",
        render: (t) => <code className="text-xs text-text-muted">{t.userId}</code>,
      },
      {
        key: "createdAt",
        header: "Criada em",
        align: "right",
        render: (t) => <span className="text-xs text-text-muted">{formatDate(t.createdAt)}</span>,
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Transações"
        description="Todo movimento de carteira — dados reais via src/modules/wallet. Consulta somente-leitura."
      />

      <FilterBar search={userId} onSearch={setUserId} placeholder="Filtrar por ID do usuário...">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Todos os status" },
              { value: "PENDING", label: "Pendentes" },
              { value: "COMPLETED", label: "Concluídas" },
              { value: "FAILED", label: "Falharam" },
            ]}
          />
          <FilterChips
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "Todos os tipos" },
              { value: "BET", label: "Apostas" },
              { value: "BET_REFUND", label: "Estornos" },
              { value: "PAYOUT", label: "Prêmios" },
              { value: "DEPOSIT", label: "Depósitos" },
              { value: "WITHDRAW_APPROVED", label: "Saques" },
              { value: "ADJUSTMENT", label: "Ajustes" },
            ]}
          />
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        onRowClick={(t) => setSelectedId(t.id)}
        emptyMessage="Nenhuma transação corresponde aos filtros"
      />

      {selectedId && <TransactionDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function TransactionDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "transaction", id],
    queryFn: () => TransactionsAdminApi.getTransaction(id),
  });
  const tx = data?.data;

  return (
    <Drawer open onClose={onClose} title={tx ? (TYPE_LABEL[tx.type] ?? tx.type) : "Carregando..."}>
      {isLoading || !tx ? (
        <DrawerSkeleton />
      ) : (
        <div>
          <DetailRow label="ID" value={<code className="text-xs">{tx.id}</code>} />
          <DetailRow label="Usuário" value={<code className="text-xs">{tx.userId}</code>} />
          <DetailRow label="Carteira" value={<code className="text-xs">{tx.walletId}</code>} />
          <DetailRow label="Tipo" value={TYPE_LABEL[tx.type] ?? tx.type} />
          <DetailRow label="Conta" value={ACCOUNT_LABEL[tx.account] ?? tx.account} />
          <DetailRow label="Valor" value={formatCents(tx.amount)} />
          <DetailRow
            label="Status"
            value={
              <StatusBadge tone={(STATUS_LABEL[tx.status] ?? { tone: "neutral" as Tone }).tone}>
                {(STATUS_LABEL[tx.status] ?? { label: tx.status }).label}
              </StatusBadge>
            }
          />
          <DetailRow label="Saldo antes" value={tx.balanceBefore !== null ? formatCents(tx.balanceBefore) : "—"} />
          <DetailRow label="Saldo depois" value={tx.balanceAfter !== null ? formatCents(tx.balanceAfter) : "—"} />
          <DetailRow label="Origem" value={tx.origin} />
          <DetailRow label="ID de origem" value={tx.originId ? <code className="text-xs">{tx.originId}</code> : "—"} />
          <DetailRow label="Descrição" value={tx.description ?? "—"} />
          <DetailRow label="Lançamento no Ledger" value={tx.ledgerId ? <code className="text-xs">{tx.ledgerId}</code> : "—"} />
          <DetailRow label="Criada em" value={formatDate(tx.createdAt)} />
          {tx.metadata && (
            <div className="mt-4">
              <JsonViewer label="Metadata" data={tx.metadata} />
            </div>
          )}
          <p className="mt-4 text-[11px] text-text-muted">
            Consulta somente-leitura — transações nunca podem ser editadas pelo backoffice.
          </p>
        </div>
      )}
    </Drawer>
  );
}
