"use client";

import {
  PageHeader,
  DataTable,
  StatusBadge,
  KpiGrid,
  Meter,
  type TableColumn,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { SecurityEventDTO } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

const KPIS = [
  { id: "open", label: "Casos abertos", value: "7", delta: "+2", trend: "up" as const },
  {
    id: "blocked",
    label: "Bloqueios automáticos (24h)",
    value: "18",
    delta: "-4",
    trend: "down" as const,
  },
  { id: "chargeback", label: "Taxa de chargeback", value: "0,21%", trend: "flat" as const },
  {
    id: "risk",
    label: "Risco médio da base",
    value: "12/100",
    delta: "-1",
    trend: "down" as const,
  },
];

export default function AdminSecurityPage() {
  const { data, loading } = useAdminData(AdminServices.securityEvents);

  const columns: TableColumn<SecurityEventDTO>[] = [
    {
      key: "kind",
      header: "Ocorrência",
      render: (s) => <span className="font-semibold">{s.kind}</span>,
    },
    {
      key: "user",
      header: "Usuário",
      render: (s) => <code className="text-xs text-text-secondary">{s.user}</code>,
    },
    {
      key: "ip",
      header: "IP / Local",
      render: (s) => (
        <div>
          <p className="text-xs tabular-nums">{s.ip}</p>
          <p className="text-[10px] text-text-muted">{s.location}</p>
        </div>
      ),
    },
    {
      key: "risk",
      header: "Risco",
      render: (s) => (
        <div className="min-w-[110px]">
          <p
            className={cn(
              "mb-1 text-xs font-bold tabular-nums",
              s.riskScore >= 80
                ? "text-error"
                : s.riskScore >= 60
                  ? "text-warning"
                  : "text-text-secondary"
            )}
          >
            {s.riskScore}/100
          </p>
          <Meter
            value={s.riskScore}
            tone={s.riskScore >= 80 ? "error" : s.riskScore >= 60 ? "warning" : "purple"}
          />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <StatusBadge
          tone={s.status === "open" ? "danger" : s.status === "reviewing" ? "warning" : "success"}
        >
          {s.status === "open" ? "Aberto" : s.status === "reviewing" ? "Em análise" : "Resolvido"}
        </StatusBadge>
      ),
    },
    {
      key: "act",
      header: "",
      align: "right",
      render: () => (
        <Button variant="ghost" size="sm" onClick={notImplemented} className="border border-border">
          Investigar
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Segurança"
        description="Antifraude, risco e proteção de contas. Regras de detecção e scoring rodarão no Backend em tempo real."
        mock
      />
      <KpiGrid kpis={KPIS} />
      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
