"use client";

import { KeyRound, Plus, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  SectionCard,
  DetailRow,
  type TableColumn,
} from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { ApiKeyDTO } from "@/lib/admin/types";

export default function AdminApiPage() {
  const { data, loading } = useAdminData(AdminServices.apiKeys);

  const columns: TableColumn<ApiKeyDTO>[] = [
    {
      key: "name",
      header: "Chave",
      render: (k) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{k.name}</p>
          <code className="text-xs text-text-muted">{k.prefix}</code>
        </div>
      ),
    },
    {
      key: "scopes",
      header: "Escopos",
      render: (k) => (
        <div className="flex flex-wrap gap-1">
          {k.scopes.map((s) => (
            <code
              key={s}
              className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-text-secondary"
            >
              {s}
            </code>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (k) => (
        <StatusBadge tone={k.status === "active" ? "success" : "neutral"}>
          {k.status === "active" ? "Ativa" : "Revogada"}
        </StatusBadge>
      ),
    },
    {
      key: "used",
      header: "Último uso",
      align: "right",
      render: (k) => <span className="text-xs text-text-muted">{k.lastUsedAt}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (k) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={notImplemented}
          disabled={k.status === "revoked"}
          className="border border-border"
        >
          Revogar
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="API Management"
        description="Chaves, escopos e webhooks. Rate limiting e rotação automática serão aplicados pelo gateway de API."
        mock
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <Plus className="size-4" /> Nova chave
          </Button>
        }
      />

      <DataTable columns={columns} rows={data ?? []} loading={loading} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Webhooks de saída"
          description="Eventos enviados aos seus sistemas"
          actions={<Webhook className="size-4 text-purple" />}
        >
          <DetailRow
            label="payments.deposit.confirmed"
            value={<StatusBadge tone="success">Ativo</StatusBadge>}
          />
          <DetailRow
            label="payments.withdraw.completed"
            value={<StatusBadge tone="success">Ativo</StatusBadge>}
          />
          <DetailRow
            label="user.registered"
            value={<StatusBadge tone="success">Ativo</StatusBadge>}
          />
          <DetailRow
            label="match.resolved"
            value={<StatusBadge tone="neutral">Inativo</StatusBadge>}
          />
        </SectionCard>

        <SectionCard
          title="Limites e uso"
          description="Consumo agregado das chaves (24h)"
          actions={<KeyRound className="size-4 text-purple" />}
        >
          <DetailRow label="Requisições" value="1.284.301" />
          <DetailRow label="Taxa de erro" value="0,04%" />
          <DetailRow label="Latência p95" value="142 ms" />
          <DetailRow label="Rate limit" value="1.000 req/min por chave" />
        </SectionCard>
      </div>
    </div>
  );
}
