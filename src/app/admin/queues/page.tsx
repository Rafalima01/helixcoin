"use client";

import { RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { QueueDTO } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

const STATUS = {
  healthy: { label: "Saudável", tone: "success" as const },
  backlogged: { label: "Acumulando", tone: "warning" as const },
  paused: { label: "Pausada", tone: "neutral" as const },
};

export default function AdminQueuesPage() {
  const { data, loading } = useAdminData(AdminServices.queues);

  const columns: TableColumn<QueueDTO>[] = [
    {
      key: "name",
      header: "Fila",
      render: (q) => <code className="text-sm font-semibold text-purple">{q.name}</code>,
    },
    {
      key: "status",
      header: "Status",
      render: (q) => (
        <StatusBadge tone={STATUS[q.status].tone} pulse={q.status === "backlogged"}>
          {STATUS[q.status].label}
        </StatusBadge>
      ),
    },
    {
      key: "pending",
      header: "Pendentes",
      align: "right",
      render: (q) => (
        <span className={cn("font-bold tabular-nums", q.pending > 500 ? "text-warning" : "")}>
          {q.pending.toLocaleString("pt-BR")}
        </span>
      ),
    },
    {
      key: "proc",
      header: "Processando",
      align: "right",
      render: (q) => <span className="tabular-nums">{q.processing}</span>,
    },
    {
      key: "failed",
      header: "Falhas",
      align: "right",
      render: (q) => (
        <span
          className={cn("tabular-nums", q.failed > 0 ? "font-bold text-error" : "text-text-muted")}
        >
          {q.failed}
        </span>
      ),
    },
    {
      key: "thr",
      header: "Vazão",
      align: "right",
      render: (q) => (
        <span className="tabular-nums text-text-secondary">{q.throughputPerMin}/min</span>
      ),
    },
    {
      key: "age",
      header: "Job mais antigo",
      align: "right",
      render: (q) => <span className="text-xs text-text-muted tabular-nums">{q.oldestJobAge}</span>,
    },
    {
      key: "act",
      header: "",
      align: "right",
      render: (q) => (
        <div className="flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={notImplemented}
            className="border border-border"
          >
            <RotateCcw className="size-3.5" /> Reprocessar
          </Button>
          {q.status === "paused" && (
            <Button variant="secondary" size="sm" onClick={notImplemented}>
              <Play className="size-3.5" /> Retomar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Filas"
        description="Workers assíncronos: webhooks, comissões, notificações e exportações. Métricas em tempo real chegarão via WebSocket."
      />
      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
