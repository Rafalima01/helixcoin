"use client";

import { useMemo, useState } from "react";
import {
  PageHeader,
  DataTable,
  FilterBar,
  StatusBadge,
  KpiGrid,
  type TableColumn,
} from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData } from "@/lib/admin/use-admin-data";
import type { WalletRowDTO } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/utils";

const KPIS = [
  {
    id: "total",
    label: "Saldo total em carteiras",
    value: "R$ 1.284.309",
    delta: "+2,1%",
    trend: "up" as const,
  },
  {
    id: "bonus",
    label: "Saldo em bônus",
    value: "R$ 84.120",
    delta: "+0,8%",
    trend: "up" as const,
  },
  {
    id: "locked",
    label: "Saldo bloqueado",
    value: "R$ 31.440",
    delta: "-12%",
    trend: "down" as const,
  },
  { id: "flagged", label: "Carteiras sinalizadas", value: "2", trend: "flat" as const },
];

export default function AdminWalletsPage() {
  const { data, loading } = useAdminData(AdminServices.wallets);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    if (!search) return data ?? [];
    const q = search.toLowerCase();
    return (data ?? []).filter((w) => w.userName.toLowerCase().includes(q) || w.id.includes(q));
  }, [data, search]);

  const columns: TableColumn<WalletRowDTO>[] = [
    {
      key: "user",
      header: "Titular",
      render: (w) => <span className="font-semibold">{w.userName}</span>,
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      render: (w) => (
        <span className="font-semibold tabular-nums text-green">{formatCurrency(w.balance)}</span>
      ),
    },
    {
      key: "bonus",
      header: "Bônus",
      align: "right",
      render: (w) => (
        <span className="tabular-nums text-text-secondary">{formatCurrency(w.bonusBalance)}</span>
      ),
    },
    {
      key: "locked",
      header: "Bloqueado",
      align: "right",
      render: (w) => (
        <span className="tabular-nums text-text-secondary">
          {w.lockedBalance > 0 ? formatCurrency(w.lockedBalance) : "—"}
        </span>
      ),
    },
    {
      key: "flag",
      header: "Risco",
      render: (w) =>
        w.flagged ? (
          <StatusBadge tone="warning">Sinalizada</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Normal</StatusBadge>
        ),
    },
    {
      key: "updated",
      header: "Atualizada",
      align: "right",
      render: (w) => <span className="text-xs text-text-muted">{w.updatedAt}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Carteiras"
        description="Posição consolidada de saldos dos jogadores. Ajustes manuais passarão pelo ledger com auditoria."
      />
      <KpiGrid kpis={KPIS} />
      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por titular ou ID da carteira..."
      />
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
