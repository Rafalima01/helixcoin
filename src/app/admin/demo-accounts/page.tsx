"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageHeader, DataTable, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { DemoAccountsAdminApi } from "@/lib/admin/demo-accounts-api";
import { formatCurrency } from "@/lib/utils";
import { CreateDemoAccountModal } from "@/components/admin/demo-accounts/create-demo-account-modal";
import { DemoAccountDrawer } from "@/components/admin/demo-accounts/demo-account-drawer";
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

export default function AdminDemoAccountsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<DemoAccountListItemDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "demo-accounts", "list"],
    queryFn: () => DemoAccountsAdminApi.list(),
  });
  const rows = data?.data ?? [];
  const selectedFresh = selected ? (rows.find((r) => r.id === selected.id) ?? null) : null;

  const columns: TableColumn<DemoAccountListItemDto>[] = [
    { key: "login", header: "Login", render: (r) => <span className="font-mono font-semibold">{r.login}</span> },
    { key: "password", header: "Senha", render: () => <span className="text-text-muted">••••••••</span> },
    {
      key: "balance",
      header: "Saldo Demo",
      render: (r) => <span className="tabular-nums font-semibold text-green">{formatCurrency(r.balanceCents / 100)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const s = STATUS[r.status] ?? STATUS.PENDING;
        return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
      },
    },
    {
      key: "createdAt",
      header: "Data de criação",
      render: (r) => <span className="text-xs text-text-secondary tabular-nums">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: "lastLoginAt",
      header: "Último login",
      render: (r) => <span className="text-xs text-text-secondary tabular-nums">{formatDateTime(r.lastLoginAt)}</span>,
    },
    {
      key: "lastActivityAt",
      header: "Última atividade",
      render: (r) => <span className="text-xs text-text-secondary tabular-nums">{formatDateTime(r.lastActivityAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Contas Demo"
        description="Contas exclusivamente demonstrativas para influenciadores, criadores de conteúdo e parceiros. Nunca aparecem em relatórios financeiros, rankings ou estatísticas de RTP."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Nova Conta Demo
          </Button>
        }
      />
      <DataTable columns={columns} rows={rows} loading={isLoading} onRowClick={(r) => setSelected(r)} emptyMessage="Nenhuma conta demo criada ainda" />
      <CreateDemoAccountModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <DemoAccountDrawer account={selectedFresh} onClose={() => setSelected(null)} />
    </div>
  );
}
