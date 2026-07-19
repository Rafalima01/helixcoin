"use client";

import { useMemo, useState } from "react";
import { PageHeader, DataTable, FilterBar, StatusBadge, KpiGrid, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData } from "@/lib/admin/use-admin-data";
import type { AffiliateRowDTO } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/utils";

const KPIS = [
  { id: "actives", label: "Afiliados ativos", value: "128", delta: "+6", trend: "up" as const },
  { id: "network", label: "Jogadores na rede", value: "2.860", delta: "+4,2%", trend: "up" as const },
  { id: "cpa", label: "CPA pago (mês)", value: "R$ 214.300", delta: "+9%", trend: "up" as const },
  { id: "rev", label: "RevShare pago (mês)", value: "R$ 388.120", delta: "+7%", trend: "up" as const },
];

export default function AdminAffiliatesPage() {
  const { data, loading } = useAdminData(AdminServices.affiliates);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    if (!search) return data ?? [];
    const q = search.toLowerCase();
    return (data ?? []).filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
  }, [data, search]);

  const columns: TableColumn<AffiliateRowDTO>[] = [
    {
      key: "name",
      header: "Afiliado",
      render: (a) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{a.name}</p>
          <code className="text-xs text-purple">{a.code}</code>
        </div>
      ),
    },
    { key: "network", header: "Rede", align: "right", render: (a) => <span className="tabular-nums">{a.network.toLocaleString("pt-BR")}</span> },
    { key: "dep", header: "Depositantes", align: "right", render: (a) => <span className="tabular-nums">{a.depositors.toLocaleString("pt-BR")}</span> },
    { key: "vol", header: "Volume gerado", align: "right", render: (a) => <span className="tabular-nums text-text-secondary">{formatCurrency(a.volume)}</span> },
    { key: "cpa", header: "CPA", align: "right", render: (a) => <span className="tabular-nums">{formatCurrency(a.cpa)}</span> },
    { key: "rev", header: "RevShare", align: "right", render: (a) => <span className="tabular-nums">{formatCurrency(a.revshare)}</span> },
    { key: "com", header: "Comissão total", align: "right", render: (a) => <span className="font-semibold tabular-nums text-green">{formatCurrency(a.commission)}</span> },
    { key: "status", header: "Status", render: (a) => <StatusBadge tone={a.status === "active" ? "success" : "neutral"}>{a.status === "active" ? "Ativo" : "Pausado"}</StatusBadge> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Afiliados"
        description="Programa multinível (3 níveis), CPA e RevShare. Percentuais são definidos nas Configurações e aplicados pelo Backend."
      />
      <KpiGrid kpis={KPIS} />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por nome ou código..." />
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
