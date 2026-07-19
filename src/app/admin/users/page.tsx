"use client";

import { useMemo, useState } from "react";
import { UserPlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  DataTable,
  FilterBar,
  FilterChips,
  StatusBadge,
  Drawer,
  DetailRow,
  type TableColumn,
} from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { AdminUserRowDTO } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/utils";

const STATUS_LABEL: Record<AdminUserRowDTO["status"], { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  active: { label: "Ativo", tone: "success" },
  blocked: { label: "Bloqueado", tone: "danger" },
  review: { label: "Em análise", tone: "warning" },
  pending: { label: "Pendente", tone: "neutral" },
};

export default function AdminUsersPage() {
  const { data, loading } = useAdminData(AdminServices.users);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<AdminUserRowDTO | null>(null);

  const rows = useMemo(() => {
    let out = data ?? [];
    if (status !== "all") out = out.filter((u) => u.status === status);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((u) => u.name.toLowerCase().includes(q) || u.email.includes(q) || u.id.includes(q));
    }
    return out;
  }, [data, search, status]);

  const columns: TableColumn<AdminUserRowDTO>[] = [
    {
      key: "name",
      header: "Usuário",
      render: (u) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{u.name}</p>
          <p className="text-xs text-text-muted truncate">{u.email}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (u) => <StatusBadge tone={STATUS_LABEL[u.status].tone}>{STATUS_LABEL[u.status].label}</StatusBadge> },
    { key: "kyc", header: "KYC", render: (u) => <span className="text-xs text-text-secondary">{u.kycLevel === "full" ? "Completo" : u.kycLevel === "basic" ? "Básico" : "—"}</span> },
    { key: "balance", header: "Saldo", align: "right", render: (u) => <span className="font-semibold tabular-nums">{formatCurrency(u.balance)}</span> },
    { key: "deposited", header: "Depositado", align: "right", render: (u) => <span className="tabular-nums text-text-secondary">{formatCurrency(u.totalDeposited)}</span> },
    { key: "lastSeen", header: "Último acesso", align: "right", render: (u) => <span className="text-xs text-text-muted">{u.lastSeenAt}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gestão de Usuários"
        description="Pesquise, filtre e gerencie contas de jogadores."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={notImplemented}>
              <Download className="size-4" /> Exportar CSV
            </Button>
            <Button variant="primary" size="sm" onClick={notImplemented}>
              <UserPlus className="size-4" /> Criar usuário
            </Button>
          </>
        }
      />

      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por nome, e-mail ou ID...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Ativos" },
            { value: "review", label: "Em análise" },
            { value: "blocked", label: "Bloqueados" },
            { value: "pending", label: "Pendentes" },
          ]}
        />
      </FilterBar>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={setSelected} emptyMessage="Nenhum usuário corresponde aos filtros" />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && (
          <div className="flex flex-col gap-5">
            <div>
              <DetailRow label="ID" value={<code className="text-xs">{selected.id}</code>} />
              <DetailRow label="E-mail" value={selected.email} />
              <DetailRow label="Status" value={<StatusBadge tone={STATUS_LABEL[selected.status].tone}>{STATUS_LABEL[selected.status].label}</StatusBadge>} />
              <DetailRow label="KYC" value={selected.kycLevel === "full" ? "Completo" : selected.kycLevel === "basic" ? "Básico" : "Não iniciado"} />
              <DetailRow label="Cadastro" value={selected.createdAt} />
              <DetailRow label="Saldo" value={formatCurrency(selected.balance)} />
              <DetailRow label="Total depositado" value={formatCurrency(selected.totalDeposited)} />
              <DetailRow label="Total sacado" value={formatCurrency(selected.totalWithdrawn)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={notImplemented}>Ajustar saldo</Button>
              <Button variant="secondary" size="sm" onClick={notImplemented}>Ver partidas</Button>
              <Button variant="secondary" size="sm" onClick={notImplemented}>Resetar senha</Button>
              <Button variant="danger" size="sm" onClick={notImplemented}>Bloquear conta</Button>
            </div>
            <p className="text-[11px] text-text-muted">Ações administrativas serão auditadas e exigem permissão RBAC (Fase 2).</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
