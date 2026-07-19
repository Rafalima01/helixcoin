"use client";

import { PageHeader, DataTable, StatusBadge, Meter, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData } from "@/lib/admin/use-admin-data";
import type { InfraNodeDTO } from "@/lib/admin/types";

const STATUS = {
  running: { label: "Rodando", tone: "success" as const },
  provisioning: { label: "Provisionando", tone: "info" as const },
  stopped: { label: "Parado", tone: "neutral" as const },
};

function Usage({ value }: { value: number }) {
  return (
    <div className="min-w-[110px]">
      <p className="mb-1 text-[11px] font-bold tabular-nums">{value}%</p>
      <Meter value={value} tone={value > 85 ? "error" : value > 70 ? "warning" : "green"} />
    </div>
  );
}

export default function AdminInfrastructurePage() {
  const { data, loading } = useAdminData(AdminServices.infraNodes);

  const columns: TableColumn<InfraNodeDTO>[] = [
    {
      key: "name",
      header: "Instância",
      render: (n) => (
        <div className="min-w-0">
          <code className="text-sm font-bold">{n.name}</code>
          <p className="text-[11px] text-text-muted">{n.kind}</p>
        </div>
      ),
    },
    { key: "region", header: "Região", render: (n) => <span className="text-xs text-text-secondary">{n.region}</span> },
    { key: "status", header: "Status", render: (n) => <StatusBadge tone={STATUS[n.status].tone} pulse={n.status === "running"}>{STATUS[n.status].label}</StatusBadge> },
    { key: "cpu", header: "CPU", render: (n) => <Usage value={n.cpu} /> },
    { key: "mem", header: "Memória", render: (n) => <Usage value={n.memory} /> },
    { key: "disk", header: "Disco", render: (n) => <Usage value={n.disk} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Infraestrutura"
        description="Instâncias, banco e workers. Provisionamento e auto-scaling serão orquestrados fora do Frontend."
      />
      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
