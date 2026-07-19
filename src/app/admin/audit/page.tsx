"use client";

import { useMemo, useState } from "react";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData } from "@/lib/admin/use-admin-data";
import type { AuditEntryDTO } from "@/lib/admin/types";

export default function AdminAuditPage() {
  const { data, loading } = useAdminData(AdminServices.audit);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");

  const rows = useMemo(() => {
    let out = data ?? [];
    if (severity !== "all") out = out.filter((a) => a.severity === severity);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((a) => a.action.toLowerCase().includes(q) || a.actor.toLowerCase().includes(q) || a.target.includes(q));
    }
    return out;
  }, [data, search, severity]);

  const columns: TableColumn<AuditEntryDTO>[] = [
    {
      key: "sev",
      header: "Nível",
      render: (a) => (
        <StatusBadge tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "neutral"}>
          {a.severity === "critical" ? "Crítico" : a.severity === "warning" ? "Atenção" : "Info"}
        </StatusBadge>
      ),
    },
    { key: "action", header: "Ação", render: (a) => <span className="font-medium">{a.action}</span> },
    {
      key: "actor",
      header: "Autor",
      render: (a) => (
        <div>
          <p className="text-sm">{a.actor}</p>
          <p className="text-[10px] uppercase text-text-muted">{a.role}</p>
        </div>
      ),
    },
    { key: "target", header: "Alvo", render: (a) => <code className="text-xs text-text-secondary">{a.target}</code> },
    { key: "ip", header: "IP", render: (a) => <span className="text-xs text-text-muted tabular-nums">{a.ip}</span> },
    { key: "at", header: "Quando", align: "right", render: (a) => <span className="text-xs text-text-muted">{a.createdAt}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Auditoria"
        description="Trilha imutável de toda ação administrativa. No Backend, cada mutação gravará autor, diff e contexto."
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por ação, autor ou alvo...">
        <FilterChips
          value={severity}
          onChange={setSeverity}
          options={[
            { value: "all", label: "Tudo" },
            { value: "critical", label: "Críticos" },
            { value: "warning", label: "Atenção" },
            { value: "info", label: "Info" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={loading} pageSize={10} />
    </div>
  );
}
