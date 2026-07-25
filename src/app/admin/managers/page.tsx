"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, FilterBar, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { ManagersAdminApi, ManagerInvitesAdminApi } from "@/lib/admin/affiliate-api";
import type { ManagerProfileAdminDto } from "@/modules/manager/dto/manager.dto";
import type { ManagerInviteAdminDto } from "@/modules/manager/dto/manager-invite.dto";
import { InviteManagerModal } from "@/components/admin/managers/invite-manager-modal";
import { ManagerDrawer } from "@/components/admin/managers/manager-drawer";
import { InviteDrawer } from "@/components/admin/managers/invite-drawer";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

type Row =
  | { id: string; kind: "manager"; name: string; code: string; commissionPercent: number | null; status: string; affiliateCount: number; createdAt: string }
  | { id: string; kind: "invite"; name: string; code: string; commissionPercent: number | null; status: string; affiliateCount: number; createdAt: string };

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  ACTIVE: { label: "Ativo", tone: "success" },
  PENDING: { label: "Pendente", tone: "warning" },
  EXPIRED: { label: "Convite expirado", tone: "neutral" },
  REVOKED: { label: "Convite revogado", tone: "danger" },
};

function inviteStatusLabel(status: string) {
  return status === "ACTIVE" ? { label: "Convite enviado", tone: "info" as const } : STATUS[status];
}

export default function AdminManagersPage() {
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: managersData, isLoading: managersLoading } = useQuery({
    queryKey: ["admin", "manager", "list"],
    queryFn: () => ManagersAdminApi.list({ page: 1, pageSize: 100 }),
  });
  const { data: invitesData, isLoading: invitesLoading } = useQuery({
    queryKey: ["admin", "manager", "invites", "list"],
    queryFn: () => ManagerInvitesAdminApi.list({ page: 1, pageSize: 100 }),
  });

  const rows = useMemo<Row[]>(() => {
    const managerRows: Row[] = (managersData?.data ?? []).map((m: ManagerProfileAdminDto) => ({
      id: m.id,
      kind: "manager",
      name: m.userName,
      code: m.inviteCode,
      commissionPercent: m.commissionPercent,
      status: m.status,
      affiliateCount: m.affiliateCount,
      createdAt: m.createdAt,
    }));
    // USED invites already have their own manager row above — don't show them twice.
    const inviteRows: Row[] = (invitesData?.data ?? [])
      .filter((i: ManagerInviteAdminDto) => i.status !== "USED")
      .map((i) => ({
        id: i.id,
        kind: "invite" as const,
        name: i.name ?? "Convite pendente",
        code: "—",
        // Not yet accepted (USED invites move to the Solicitações queue) — commission is decided at approval, not here.
        commissionPercent: null,
        status: i.status,
        affiliateCount: 0,
        createdAt: i.createdAt,
      }));

    const combined = [...managerRows, ...inviteRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!search) return combined;
    const q = search.toLowerCase();
    return combined.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [managersData, invitesData, search]);

  const columns: TableColumn<Row>[] = [
    {
      key: "name",
      header: "Nome",
      render: (r) => <p className="font-semibold truncate">{r.name}</p>,
    },
    {
      key: "code",
      header: "Código",
      render: (r) => <code className="text-xs text-purple">{r.code}</code>,
    },
    {
      key: "commission",
      header: "Comissão",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.commissionPercent !== null ? `${r.commissionPercent}%` : "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const s = r.kind === "invite" ? inviteStatusLabel(r.status) : STATUS[r.status];
        return <StatusBadge tone={s?.tone ?? "neutral"}>{s?.label ?? r.status}</StatusBadge>;
      },
    },
    {
      key: "affiliates",
      header: "Afiliados",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.kind === "manager" ? r.affiliateCount : "—"}</span>,
    },
    {
      key: "createdAt",
      header: "Data de cadastro",
      align: "right",
      render: (r) => <span className="text-xs text-text-muted tabular-nums">{formatDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gerentes"
        description="Cadastro exclusivamente por convite — o candidato preenche os próprios dados ao abrir o link; a comissão máxima é decidida na aprovação da solicitação."
        actions={
          <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" /> Gerar link de convite
          </Button>
        }
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por nome ou código..." />
      <DataTable columns={columns} rows={rows} loading={managersLoading || invitesLoading} pageSize={10} onRowClick={setSelected} />

      {selected?.kind === "manager" && <ManagerDrawer id={selected.id} onClose={() => setSelected(null)} />}
      {selected?.kind === "invite" && <InviteDrawer id={selected.id} onClose={() => setSelected(null)} />}
      <InviteManagerModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
