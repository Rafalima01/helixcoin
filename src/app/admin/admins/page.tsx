"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldPlus, KeyRound, Eye, Headset, LineChart, Crown, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, DataTable, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { IdentityAdminApi } from "@/lib/admin/identity-api";
import { CreateAdminModal } from "@/components/admin/admins/create-admin-modal";
import type { UserResponseDto } from "@/modules/identity/dto/user.dto";

const STAFF_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
  "OPERATOR",
  "MODERATOR",
  "SUPPORT",
  "COMPLIANCE",
  "AUDIT",
] as const;

const ROLE_META: Record<(typeof STAFF_ROLES)[number], { label: string; icon: typeof Crown; desc: string }> = {
  SUPER_ADMIN: { label: "Super Admin", icon: Crown, desc: "Acesso total, ignora a matriz de permissões." },
  ADMIN: { label: "Admin", icon: KeyRound, desc: "Gestão operacional completa." },
  FINANCE: { label: "Financeiro", icon: LineChart, desc: "Carteiras, ledger e gateways." },
  OPERATOR: { label: "Operador", icon: KeyRound, desc: "Configuração de jogo e RTP." },
  MODERATOR: { label: "Moderador", icon: Headset, desc: "Bloqueio e sessões de jogadores." },
  SUPPORT: { label: "Suporte", icon: Headset, desc: "Atendimento e ações limitadas." },
  COMPLIANCE: { label: "Compliance", icon: Scale, desc: "Auditoria e conformidade." },
  AUDIT: { label: "Auditoria", icon: Eye, desc: "Somente leitura e relatórios." },
};

const STATUS_LABEL: Record<UserResponseDto["status"], { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Ativo", tone: "success" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
  SUSPENDED: { label: "Suspenso", tone: "warning" },
  PENDING: { label: "Pendente", tone: "neutral" },
};

export default function AdminAdminsPage() {
  const [inviting, setInviting] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => IdentityAdminApi.searchUsers({ page: 1, pageSize: 100 }),
  });

  const staff = (data?.data ?? []).filter((u) => (STAFF_ROLES as readonly string[]).includes(u.role));

  const columns: TableColumn<UserResponseDto>[] = [
    {
      key: "name",
      header: "Administrador",
      render: (a) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{a.fullName}</p>
          <p className="text-xs text-text-muted truncate">{a.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Papel (RBAC)",
      render: (a) => (
        <StatusBadge tone={a.role === "SUPER_ADMIN" ? "pink" : "info"}>
          {ROLE_META[a.role as keyof typeof ROLE_META]?.label ?? a.role}
        </StatusBadge>
      ),
    },
    {
      key: "mfa",
      header: "MFA",
      render: (a) => (
        <StatusBadge tone={a.mfaEnabled ? "success" : "warning"}>
          {a.mfaEnabled ? "Ativo" : "Pendente"}
        </StatusBadge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => (
        <StatusBadge tone={STATUS_LABEL[a.status].tone}>{STATUS_LABEL[a.status].label}</StatusBadge>
      ),
    },
    {
      key: "login",
      header: "Último login",
      align: "right",
      render: (a) => (
        <span className="text-xs text-text-muted">
          {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("pt-BR") : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gestão Administrativa"
        description="Contas com papéis não-jogador (RBAC) — mesma base de usuários do módulo Identity, filtrada por papel."
        actions={
          <Button variant="primary" size="sm" onClick={() => setInviting(true)}>
            <ShieldPlus className="size-4" /> Convidar administrador
          </Button>
        }
      />

      <CreateAdminModal open={inviting} onClose={() => setInviting(false)} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAFF_ROLES.map((role) => {
          const meta = ROLE_META[role];
          return (
            <Card key={role} className="p-4 flex flex-col gap-2">
              <meta.icon className="size-4 text-purple" />
              <p className="text-sm font-bold">{meta.label}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{meta.desc}</p>
            </Card>
          );
        })}
      </div>

      <DataTable columns={columns} rows={staff} loading={isLoading} error={isError} onRetry={refetch} />
    </div>
  );
}
