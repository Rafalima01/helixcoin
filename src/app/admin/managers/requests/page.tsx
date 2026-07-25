"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, DataTable, type TableColumn } from "@/components/admin/ui";
import { ManagerInvitesAdminApi } from "@/lib/admin/affiliate-api";
import type { ManagerInviteAdminDto } from "@/modules/manager/dto/manager-invite.dto";
import { RequestDrawer } from "@/components/admin/managers/request-drawer";

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

export default function AdminManagerRequestsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "manager", "requests", "pending"],
    queryFn: () => ManagerInvitesAdminApi.listPendingApprovals({ page: 1, pageSize: 100 }),
  });

  const rows = data?.data ?? [];

  const columns: TableColumn<ManagerInviteAdminDto>[] = [
    { key: "name", header: "Nome", render: (r) => <p className="font-semibold truncate">{r.name}</p> },
    { key: "email", header: "Email", render: (r) => <span className="text-sm text-text-secondary truncate">{r.email}</span> },
    { key: "phone", header: "Telefone", render: (r) => <span className="text-sm text-text-secondary">{r.phone ?? "—"}</span> },
    { key: "date", header: "Data", align: "right", render: (r) => <span className="text-xs text-text-muted tabular-nums">{formatDate(r.acceptedAt)}</span> },
    { key: "ip", header: "IP", render: (r) => <span className="text-xs text-text-muted">{r.acceptedIp ?? "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Solicitações de Gerente"
        description="Cadastros que aceitaram um convite e aguardam aprovação — a comissão máxima é definida aqui, na aprovação."
      />
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={10} onRowClick={(r) => setSelectedId(r.id)} />

      {selectedId && <RequestDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
