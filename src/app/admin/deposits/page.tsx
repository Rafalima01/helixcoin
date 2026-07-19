"use client";

import { useMemo, useState } from "react";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, KpiGrid, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData } from "@/lib/admin/use-admin-data";
import type { PaymentRowDTO, PaymentStatus } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/utils";

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  completed: { label: "Concluído", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  processing: { label: "Processando", tone: "info" },
  failed: { label: "Falhou", tone: "danger" },
  refunded: { label: "Estornado", tone: "neutral" },
};

const KPIS = [
  { id: "vol", label: "Volume (24h)", value: "R$ 842.310", delta: "+15,2%", trend: "up" as const },
  { id: "count", label: "Transações (24h)", value: "6.481", delta: "+11%", trend: "up" as const },
  { id: "rate", label: "Taxa de aprovação", value: "96,4%", delta: "-1,1 pp", trend: "down" as const },
  { id: "avg", label: "Ticket médio", value: "R$ 129,97", delta: "+3,2%", trend: "up" as const },
];

export default function AdminDepositsPage() {
  const { data, loading } = useAdminData(AdminServices.deposits);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    let out = data ?? [];
    if (status !== "all") out = out.filter((p) => p.status === status);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((p) => p.userName.toLowerCase().includes(q) || p.id.includes(q));
    }
    return out;
  }, [data, search, status]);

  const columns: TableColumn<PaymentRowDTO>[] = [
    { key: "id", header: "Transação", render: (p) => <code className="text-xs text-text-secondary">{p.id}</code> },
    { key: "user", header: "Usuário", render: (p) => <span className="font-medium">{p.userName}</span> },
    { key: "gateway", header: "Gateway", render: (p) => <span className="text-text-secondary">{p.gateway}</span> },
    { key: "amount", header: "Valor", align: "right", render: (p) => <span className="font-semibold tabular-nums text-green">{formatCurrency(p.amount)}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</StatusBadge> },
    { key: "at", header: "Data/Hora", align: "right", render: (p) => <span className="text-xs text-text-muted tabular-nums">{p.createdAt}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Depósitos" description="Monitoramento de entradas via PIX em todos os gateways." />
      <KpiGrid kpis={KPIS} />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por usuário ou transação...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "completed", label: "Concluídos" },
            { value: "pending", label: "Pendentes" },
            { value: "failed", label: "Falhas" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={loading} pageSize={10} />
    </div>
  );
}
