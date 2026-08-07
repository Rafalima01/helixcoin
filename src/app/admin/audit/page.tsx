"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, DataTable, FilterBar, FilterChips, type TableColumn } from "@/components/admin/ui";
import { IdentityAdminApi } from "@/lib/admin/identity-api";
import type { AuditLogResponseDto } from "@/modules/identity/dto/audit.dto";

const ACTION_GROUPS = [
  { value: "all", label: "Tudo" },
  { value: "auth.", label: "Autenticação" },
  { value: "admin.user.", label: "Gestão de usuários" },
  { value: "auth.session.", label: "Sessões" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export default function AdminAuditPage() {
  const [search, setSearch] = useState("");
  const [actionPrefix, setActionPrefix] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "audit", actionPrefix],
    queryFn: () =>
      IdentityAdminApi.searchAudit({
        action: actionPrefix === "all" ? undefined : actionPrefix,
        page: 1,
        pageSize: 100,
      }),
  });

  const rows = useMemo(() => {
    let out = data?.data ?? [];
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(
        (a) =>
          a.action.toLowerCase().includes(q) ||
          (a.actorId ?? "").toLowerCase().includes(q) ||
          (a.entityId ?? "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [data, search]);

  const columns: TableColumn<AuditLogResponseDto>[] = [
    {
      key: "action",
      header: "Ação",
      render: (a) => <span className="font-medium">{a.action}</span>,
    },
    {
      key: "actor",
      header: "Autor",
      render: (a) => (
        <div>
          <code className="text-xs">{a.actorId ?? "sistema"}</code>
          <p className="text-[10px] uppercase text-text-muted">{a.actorType}</p>
        </div>
      ),
    },
    {
      key: "entity",
      header: "Entidade",
      render: (a) => (
        <code className="text-xs text-text-secondary">
          {a.entityType}
          {a.entityId ? `#${a.entityId.slice(0, 8)}` : ""}
        </code>
      ),
    },
    {
      key: "ip",
      header: "IP",
      render: (a) => <span className="text-xs text-text-muted tabular-nums">{a.ip ?? "—"}</span>,
    },
    {
      key: "at",
      header: "Quando",
      align: "right",
      render: (a) => <span className="text-xs text-text-muted">{formatDate(a.createdAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Auditoria"
        description="Trilha imutável (AuditLog) — cada mutação grava autor, diff, IP e sessão. Registros nunca podem ser apagados."
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por ação, autor ou entidade...">
        <FilterChips value={actionPrefix} onChange={setActionPrefix} options={ACTION_GROUPS} />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={isLoading} error={isError} onRetry={refetch} pageSize={10} />
    </div>
  );
}
