"use client";

import { ShieldPlus, KeyRound, Eye, Headset, LineChart, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, DataTable, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { AdminAccountDTO } from "@/lib/admin/types";

const ROLES = [
  { role: "owner", label: "Owner", icon: Crown, desc: "Acesso total, incluindo RBAC e chaves." },
  { role: "admin", label: "Admin", icon: KeyRound, desc: "Gestão operacional completa." },
  {
    role: "finance",
    label: "Financeiro",
    icon: LineChart,
    desc: "Aprova saques, ledger e gateways.",
  },
  { role: "support", label: "Suporte", icon: Headset, desc: "Atendimento e ações limitadas." },
  { role: "analyst", label: "Analista", icon: Eye, desc: "Somente leitura e relatórios." },
];

const ROLE_LABEL: Record<AdminAccountDTO["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  finance: "Financeiro",
  support: "Suporte",
  analyst: "Analista",
};

export default function AdminAdminsPage() {
  const { data, loading } = useAdminData(AdminServices.adminAccounts);

  const columns: TableColumn<AdminAccountDTO>[] = [
    {
      key: "name",
      header: "Administrador",
      render: (a) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{a.name}</p>
          <p className="text-xs text-text-muted truncate">{a.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Papel (RBAC)",
      render: (a) => (
        <StatusBadge tone={a.role === "owner" ? "pink" : "info"}>{ROLE_LABEL[a.role]}</StatusBadge>
      ),
    },
    {
      key: "2fa",
      header: "2FA",
      render: (a) => (
        <StatusBadge tone={a.twoFactor ? "success" : "warning"}>
          {a.twoFactor ? "Ativo" : "Pendente"}
        </StatusBadge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => (
        <StatusBadge tone={a.status === "active" ? "success" : "danger"}>
          {a.status === "active" ? "Ativo" : "Suspenso"}
        </StatusBadge>
      ),
    },
    {
      key: "login",
      header: "Último login",
      align: "right",
      render: (a) => <span className="text-xs text-text-muted">{a.lastLoginAt}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gestão Administrativa"
        description="Contas administrativas, papéis e permissões (RBAC). A matriz de permissões definitiva será aplicada no Backend."
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <ShieldPlus className="size-4" /> Convidar administrador
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {ROLES.map((r) => (
          <Card key={r.role} className="p-4 flex flex-col gap-2">
            <r.icon className="size-4 text-purple" />
            <p className="text-sm font-bold">{r.label}</p>
            <p className="text-xs text-text-secondary leading-relaxed">{r.desc}</p>
          </Card>
        ))}
      </div>

      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
