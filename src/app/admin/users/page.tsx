"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, ShieldOff, ShieldCheck, Trash2, RotateCcw, MonitorX } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PageHeader,
  DataTable,
  FilterBar,
  FilterChips,
  StatusBadge,
  Drawer,
  DetailRow,
  AdminTabs,
  type TableColumn,
} from "@/components/admin/ui";
import { IdentityAdminApi, ApiError } from "@/lib/admin/identity-api";
import type { UserResponseDto } from "@/modules/identity/dto/user.dto";
import type { SessionResponseDto } from "@/modules/identity/dto/session.dto";
import type { AuditLogResponseDto } from "@/modules/identity/dto/audit.dto";

const STATUS_LABEL: Record<UserResponseDto["status"], { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Ativo", tone: "success" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
  SUSPENDED: { label: "Suspenso", tone: "warning" },
  PENDING: { label: "Pendente", tone: "neutral" },
};

const ROLE_OPTIONS = [
  { value: "all", label: "Todos os papéis" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "FINANCE", label: "Financeiro" },
  { value: "OPERATOR", label: "Operador" },
  { value: "MODERATOR", label: "Moderador" },
  { value: "SUPPORT", label: "Suporte" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "AUDIT", label: "Auditoria" },
  { value: "USER", label: "Usuário" },
  { value: "AFFILIATE", label: "Afiliado" },
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", search, status],
    queryFn: () => IdentityAdminApi.searchUsers({ search, status, page: 1, pageSize: 100 }),
  });

  const rows = data?.data ?? [];

  const columns: TableColumn<UserResponseDto>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Usuário",
        render: (u) => (
          <div className="min-w-0">
            <p className="font-semibold truncate">{u.fullName}</p>
            <p className="text-xs text-text-muted truncate">{u.email}</p>
          </div>
        ),
      },
      {
        key: "role",
        header: "Papel",
        render: (u) => <span className="text-xs text-text-secondary">{u.role}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (u) => (
          <StatusBadge tone={STATUS_LABEL[u.status].tone}>{STATUS_LABEL[u.status].label}</StatusBadge>
        ),
      },
      {
        key: "verified",
        header: "Verificado",
        render: (u) => (
          <span className="text-xs text-text-secondary">{u.emailVerified ? "Email ✓" : "Email —"}</span>
        ),
      },
      {
        key: "lastLogin",
        header: "Último acesso",
        align: "right",
        render: (u) => <span className="text-xs text-text-muted">{formatDate(u.lastLoginAt)}</span>,
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gestão de Usuários"
        description="Pesquise, filtre e gerencie contas — dados reais via src/modules/identity."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <UserPlus className="size-4" /> Criar usuário
          </Button>
        }
      />

      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por nome, email, username ou ID...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "ACTIVE", label: "Ativos" },
            { value: "PENDING", label: "Pendentes" },
            { value: "BLOCKED", label: "Bloqueados" },
            { value: "SUSPENDED", label: "Suspensos" },
          ]}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        onRowClick={(u) => setSelectedId(u.id)}
        emptyMessage="Nenhum usuário corresponde aos filtros"
      />

      {selectedId && (
        <UserDrawer
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onMutated={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
        />
      )}

      {creating && (
        <CreateUserDrawer
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          }}
        />
      )}
    </div>
  );
}

function UserDrawer({
  userId,
  onClose,
  onMutated,
}: {
  userId: string;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [tab, setTab] = useState("perfil");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => IdentityAdminApi.getUser(userId),
  });
  const user = data?.data;

  const invalidate = () => {
    onMutated();
    return IdentityAdminApi.getUser(userId);
  };

  const block = useMutation({
    mutationFn: () => IdentityAdminApi.blockUser(userId),
    onSuccess: () => {
      toast.success("Usuário bloqueado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao bloquear"),
  });
  const unblock = useMutation({
    mutationFn: () => IdentityAdminApi.unblockUser(userId),
    onSuccess: () => {
      toast.success("Usuário desbloqueado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao desbloquear"),
  });
  const softDelete = useMutation({
    mutationFn: () => IdentityAdminApi.softDeleteUser(userId),
    onSuccess: () => {
      toast.success("Usuário removido");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao remover"),
  });
  const restore = useMutation({
    mutationFn: () => IdentityAdminApi.restoreUser(userId),
    onSuccess: () => {
      toast.success("Usuário restaurado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao restaurar"),
  });

  return (
    <Drawer open onClose={onClose} title={user?.fullName ?? "Carregando..."}>
      {isLoading || !user ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <AdminTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "perfil", label: "Perfil" },
              { key: "sessoes", label: "Sessões" },
              { key: "historico", label: "Histórico" },
            ]}
          />

          {tab === "perfil" && (
            <div className="flex flex-col gap-4">
              <div>
                <DetailRow label="ID" value={<code className="text-xs">{user.id}</code>} />
                <DetailRow label="Username" value={`@${user.username}`} />
                <DetailRow label="Email" value={user.email} />
                <DetailRow label="Telefone" value={user.phone ?? "—"} />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge tone={STATUS_LABEL[user.status].tone}>
                      {STATUS_LABEL[user.status].label}
                    </StatusBadge>
                  }
                />
                <DetailRow label="Papel" value={user.role} />
                <DetailRow label="Email verificado" value={user.emailVerified ? "Sim" : "Não"} />
                <DetailRow label="MFA" value={user.mfaEnabled ? "Ativado" : "Desativado"} />
                <DetailRow label="Conta bloqueada por tentativas" value={user.locked ? "Sim" : "Não"} />
                <DetailRow label="Cadastro" value={formatDate(user.createdAt)} />
                <DetailRow label="Último login" value={formatDate(user.lastLoginAt)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {user.status === "BLOCKED" ? (
                  <Button variant="secondary" size="sm" loading={unblock.isPending} onClick={() => unblock.mutate()}>
                    <ShieldCheck className="size-4" /> Desbloquear
                  </Button>
                ) : (
                  <Button variant="danger" size="sm" loading={block.isPending} onClick={() => block.mutate()}>
                    <ShieldOff className="size-4" /> Bloquear conta
                  </Button>
                )}
                <Button variant="danger" size="sm" loading={softDelete.isPending} onClick={() => softDelete.mutate()}>
                  <Trash2 className="size-4" /> Remover
                </Button>
                <Button variant="secondary" size="sm" loading={restore.isPending} onClick={() => restore.mutate()}>
                  <RotateCcw className="size-4" /> Restaurar
                </Button>
              </div>
              <p className="text-[11px] text-text-muted">
                Toda ação aqui grava uma linha imutável em AuditLog (autor, antes/depois, IP).
              </p>
            </div>
          )}

          {tab === "sessoes" && <UserSessionsTab userId={userId} />}
          {tab === "historico" && <UserHistoryTab userId={userId} />}
        </div>
      )}
    </Drawer>
  );
}

function UserSessionsTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-sessions", userId],
    queryFn: () => IdentityAdminApi.listUserSessions(userId),
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) => IdentityAdminApi.revokeUserSession(userId, sessionId),
    onSuccess: () => {
      toast.success("Sessão encerrada");
      queryClient.invalidateQueries({ queryKey: ["admin", "user-sessions", userId] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao encerrar sessão"),
  });

  if (isLoading) return <p className="text-sm text-text-muted">Carregando...</p>;
  const sessions = data?.data ?? [];
  if (sessions.length === 0) return <p className="text-sm text-text-muted">Nenhuma sessão registrada.</p>;

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s: SessionResponseDto) => (
        <div key={s.id} className="rounded-xl border border-border bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {s.browser ?? "Navegador"} · {s.os ?? "SO desconhecido"}
              </p>
              <p className="text-xs text-text-muted">{s.ip ?? "IP desconhecido"}</p>
              <p className="text-xs text-text-muted">{formatDate(s.lastActivityAt)}</p>
            </div>
            <StatusBadge tone={s.active ? "success" : "neutral"}>
              {s.active ? "Ativa" : "Encerrada"}
            </StatusBadge>
          </div>
          {s.active && (
            <Button
              variant="danger"
              size="sm"
              className="mt-2"
              loading={revoke.isPending}
              onClick={() => revoke.mutate(s.id)}
            >
              <MonitorX className="size-4" /> Encerrar sessão
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function UserHistoryTab({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-history", userId],
    queryFn: () => IdentityAdminApi.listUserLoginHistory(userId),
  });

  if (isLoading) return <p className="text-sm text-text-muted">Carregando...</p>;
  const rows = data?.data ?? [];
  if (rows.length === 0) return <p className="text-sm text-text-muted">Nenhum evento de login registrado.</p>;

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row: AuditLogResponseDto) => (
        <div key={row.id} className="rounded-xl border border-border bg-white/[0.02] p-3">
          <p className="text-sm font-semibold">{row.action}</p>
          <p className="text-xs text-text-muted">
            {row.ip ?? "IP desconhecido"} · {formatDate(row.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function CreateUserDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    role: "USER",
  });

  const create = useMutation({
    mutationFn: () => IdentityAdminApi.createUser(form),
    onSuccess: () => {
      toast.success("Usuário criado");
      onCreated();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao criar usuário"),
  });

  return (
    <Drawer open onClose={onClose} title="Criar usuário">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nome"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            required
          />
          <Input
            label="Sobrenome"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            required
          />
        </div>
        <Input
          label="Username"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <Input
          label="Senha temporária"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Papel</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          >
            {ROLE_OPTIONS.filter((r) => r.value !== "all").map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="primary" loading={create.isPending}>
          Criar usuário
        </Button>
      </form>
    </Drawer>
  );
}
