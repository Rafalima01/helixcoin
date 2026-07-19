"use client";

import { useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, KpiGrid, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { PaymentRowDTO, PaymentStatus } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/utils";

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  completed: { label: "Concluído", tone: "success" },
  pending: { label: "Aguardando aprovação", tone: "warning" },
  processing: { label: "Processando", tone: "info" },
  failed: { label: "Falhou", tone: "danger" },
  refunded: { label: "Estornado", tone: "neutral" },
};

const KPIS = [
  { id: "vol", label: "Volume (24h)", value: "R$ 512.940", delta: "-3,4%", trend: "down" as const },
  { id: "queue", label: "Fila de aprovação", value: "23", delta: "+8", trend: "up" as const },
  { id: "sla", label: "SLA médio de pagamento", value: "3m 42s", delta: "-12%", trend: "up" as const },
  { id: "risk", label: "Retidos por risco", value: "4", trend: "flat" as const },
];

export default function AdminWithdrawalsPage() {
  const { data, loading } = useAdminData(AdminServices.withdrawals);
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
    { key: "id", header: "Solicitação", render: (p) => <code className="text-xs text-text-secondary">{p.id}</code> },
    { key: "user", header: "Usuário", render: (p) => <span className="font-medium">{p.userName}</span> },
    { key: "gateway", header: "Gateway", render: (p) => <span className="text-text-secondary">{p.gateway}</span> },
    { key: "amount", header: "Valor", align: "right", render: (p) => <span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</StatusBadge> },
    {
      key: "actions",
      header: "Ações",
      align: "right",
      render: (p) =>
        p.status === "pending" ? (
          <div className="flex justify-end gap-1.5">
            <Button variant="success" size="sm" onClick={notImplemented}>Aprovar</Button>
            <Button variant="ghost" size="sm" onClick={notImplemented} className="border border-border">Reter</Button>
          </div>
        ) : (
          <span className="text-xs text-text-muted tabular-nums">{p.createdAt}</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Saques"
        description="Fila de aprovação e histórico de saídas. Regras de aprovação automática serão definidas no Backend."
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <CheckCheck className="size-4" /> Aprovar selecionados
          </Button>
        }
      />
      <KpiGrid kpis={KPIS} />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por usuário ou solicitação...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "pending", label: "Aguardando" },
            { value: "processing", label: "Processando" },
            { value: "completed", label: "Concluídos" },
            { value: "failed", label: "Falhas" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={loading} pageSize={10} />
    </div>
  );
}
