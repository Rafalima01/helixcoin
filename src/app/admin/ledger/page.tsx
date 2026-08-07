"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, DataTable, FilterBar, Drawer, DetailRow, LedgerRow, DrawerSkeleton, type TableColumn } from "@/components/admin/ui";
import { LedgerAdminApi } from "@/lib/admin/ledger-api";
import type { LedgerEntryDto } from "@/modules/ledger/dto/ledger.dto";
import { formatCurrency } from "@/lib/utils";

function formatCents(cents: number) {
  return formatCurrency(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export default function AdminLedgerPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "ledger", search],
    queryFn: () =>
      LedgerAdminApi.listEntries({
        debitAccount: search || undefined,
        page: 1,
        pageSize: 100,
      }),
  });

  const rows = data?.data ?? [];

  const columns: TableColumn<LedgerEntryDto>[] = [
    {
      key: "accounts",
      header: "Débito → Crédito",
      render: (l) => <LedgerRow debitAccount={l.debitAccount} creditAccount={l.creditAccount} />,
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      render: (l) => (
        <span className="font-semibold tabular-nums">
          {formatCents(l.amount)} {l.currency}
        </span>
      ),
    },
    {
      key: "reference",
      header: "Referência",
      render: (l) => <span className="text-xs text-text-secondary">{l.reference ?? "—"}</span>,
    },
    {
      key: "referenceType",
      header: "Origem",
      render: (l) => <span className="text-xs text-text-muted">{l.referenceType ?? "—"}</span>,
    },
    {
      key: "createdAt",
      header: "Timestamp",
      align: "right",
      render: (l) => <span className="text-xs text-text-muted tabular-nums">{formatDate(l.createdAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ledger Financeiro"
        description="Livro-razão de dupla entrada, imutável — dados reais via src/modules/ledger. Nenhuma edição manual é permitida em nenhum lugar da plataforma."
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Filtrar por conta de débito (ex: PLATFORM)..." />
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        onRowClick={(l) => setSelectedId(l.id)}
        emptyMessage="Nenhum lançamento encontrado"
      />

      {selectedId && <LedgerEntryDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function LedgerEntryDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "ledger-entry", id],
    queryFn: () => LedgerAdminApi.getEntry(id),
  });
  const entry = data?.data;

  return (
    <Drawer open onClose={onClose} title="Lançamento">
      {isLoading || !entry ? (
        <DrawerSkeleton />
      ) : (
        <div>
          <DetailRow label="ID" value={<code className="text-xs">{entry.id}</code>} />
          <DetailRow label="Transação" value={<code className="text-xs">{entry.transactionId}</code>} />
          <DetailRow label="Conta de débito" value={<code className="text-xs">{entry.debitAccount}</code>} />
          <DetailRow label="Conta de crédito" value={<code className="text-xs">{entry.creditAccount}</code>} />
          <DetailRow label="Valor" value={`${formatCents(entry.amount)} ${entry.currency}`} />
          <DetailRow label="Referência" value={entry.reference ?? "—"} />
          <DetailRow label="Tipo de referência" value={entry.referenceType ?? "—"} />
          <DetailRow label="Descrição" value={entry.description ?? "—"} />
          <DetailRow label="Criado em" value={formatDate(entry.createdAt)} />
          <p className="mt-4 text-[11px] text-text-muted">
            Lançamentos são append-only — não existe rota de edição ou exclusão em nenhuma camada da API.
          </p>
        </div>
      )}
    </Drawer>
  );
}
