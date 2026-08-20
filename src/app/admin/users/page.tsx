"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, ShieldOff, ShieldCheck, Trash2, RotateCcw, MonitorX, Plus, Minus, FlaskConical } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  PageHeader,
  DataTable,
  FilterBar,
  FilterChips,
  StatusBadge,
  Drawer,
  DetailRow,
  DrawerSkeleton,
  AdminTabs,
  type TableColumn,
} from "@/components/admin/ui";
import { IdentityAdminApi, ApiError } from "@/lib/admin/identity-api";
import { WalletsAdminApi, TransactionsAdminApi } from "@/lib/admin/wallet-api";
import { AffiliateApplicationsAdminApi } from "@/lib/admin/affiliate-api";
import type { AffiliateProfileAdminDto } from "@/modules/affiliate/dto/affiliate.dto";
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "users", search, status],
    queryFn: () =>
      IdentityAdminApi.searchUsers({
        search,
        status: status === "DELETED" ? undefined : status,
        includeDeleted: status === "DELETED" ? true : undefined,
        page: 1,
        pageSize: 100,
      }),
  });

  // "DELETED" isn't a real UserStatus (deletion is tracked via deletedAt,
  // orthogonal to status) — the server just returns everyone when
  // includeDeleted is set, so filter down to deleted-only here.
  const rows = useMemo(() => {
    const items = data?.data ?? [];
    return status === "DELETED" ? items.filter((u) => u.deletedAt) : items;
  }, [data, status]);

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
        render: (u) =>
          u.deletedAt ? (
            <StatusBadge tone="neutral">Excluído</StatusBadge>
          ) : (
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
            { value: "DELETED", label: "Excluídos" },
          ]}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
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
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => IdentityAdminApi.getUser(userId),
  });
  const user = data?.data;

  // Refetches THIS drawer's own query too, not just the list behind it —
  // otherwise the drawer keeps showing pre-mutation values (e.g. "Bloqueado"
  // right after clicking Desbloquear) until it's closed and reopened.
  const invalidate = () => {
    onMutated();
    return queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
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
        <DrawerSkeleton />
      ) : (
        <div className="flex flex-col gap-5">
          <AdminTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "perfil", label: "Perfil" },
              { key: "financeiro", label: "Financeiro" },
              { key: "afiliado", label: "Afiliado" },
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
                <DetailRow
                  label="Conta Demo"
                  value={
                    user.isDemo ? (
                      <StatusBadge tone="info">Sim</StatusBadge>
                    ) : (
                      <span className="text-text-muted">Não</span>
                    )
                  }
                />
                <DetailRow label="Cadastro" value={formatDate(user.createdAt)} />
                <DetailRow label="Último login" value={formatDate(user.lastLoginAt)} />
                <LastIpRow userId={userId} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {user.deletedAt ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="col-span-2"
                    loading={restore.isPending}
                    onClick={() => restore.mutate()}
                  >
                    <RotateCcw className="size-4" /> Restaurar
                  </Button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              <p className="text-[11px] text-text-muted">
                Toda ação aqui grava uma linha imutável em AuditLog (autor, antes/depois, IP).
              </p>
            </div>
          )}

          {tab === "financeiro" && <UserFinanceTab userId={userId} isDemo={user.isDemo} />}
          {tab === "afiliado" && <UserAffiliateTab userId={userId} />}
          {tab === "sessoes" && <UserSessionsTab userId={userId} />}
          {tab === "historico" && <UserHistoryTab userId={userId} />}
        </div>
      )}
    </Drawer>
  );
}

/**
 * "Último IP" is derived from the most recent session rather than stored on
 * User: Session already records `ip` per login, so a dedicated User.lastLoginIp
 * column would be a second, drift-prone copy of the same fact.
 */
function LastIpRow({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["admin", "user-sessions", userId],
    queryFn: () => IdentityAdminApi.listUserSessions(userId),
  });
  const sessions = (data?.data ?? []) as SessionResponseDto[];
  const latest = [...sessions].sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  )[0];
  return <DetailRow label="Último IP" value={<code className="text-xs">{latest?.ip ?? "—"}</code>} />;
}

/**
 * Wallet balances, lifetime totals and the money-moving admin actions.
 * Balances/transactions come from the same endpoints /admin/wallets already
 * uses — no new aggregate: the totals are summed from the transaction ledger
 * so they can never disagree with the Transações screen.
 */
/** /admin/transactions caps pageSize at 100, so lifetime totals need real pagination. */
const TX_PAGE_SIZE = 100;
/** 5.000 transações. Além disso a soma vira `truncated` em vez de um número errado. */
const TX_MAX_PAGES = 50;

/**
 * Every COMPLETED transaction for one user, paginated.
 *
 * Asking for a single oversized page (pageSize=500) silently 400s against the
 * endpoint's max of 100 — and a failed query reads as "zero transactions",
 * which renders as a page full of R$ 0,00 that looks like real data. So the
 * pages are walked properly, and if a user somehow has more than TX_MAX_PAGES
 * worth, `truncated` is returned so the UI can say the totals are partial
 * instead of quietly under-reporting.
 */
async function fetchAllTransactions(userId: string) {
  const first = await TransactionsAdminApi.listTransactions({ userId, page: 1, pageSize: TX_PAGE_SIZE });
  const totalPages = first.meta?.totalPages ?? 1;
  const rows = [...first.data];

  const lastPage = Math.min(totalPages, TX_MAX_PAGES);
  for (let page = 2; page <= lastPage; page++) {
    const next = await TransactionsAdminApi.listTransactions({ userId, page, pageSize: TX_PAGE_SIZE });
    rows.push(...next.data);
  }

  return { rows, truncated: totalPages > TX_MAX_PAGES };
}

function UserFinanceTab({ userId, isDemo }: { userId: string; isDemo: boolean }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<"add" | "remove" | "demo" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "wallet", userId],
    queryFn: () => WalletsAdminApi.getWallet(userId),
  });

  const { data: txData } = useQuery({
    queryKey: ["admin", "user-tx-totals", userId],
    queryFn: () => fetchAllTransactions(userId),
  });

  const totals = useMemo(() => {
    const rows = txData?.rows ?? [];
    // `amount` comes back as a magnitude (a debit is +2500, not -2500), so the
    // direction lives entirely in `type` — hence summing by type, not by sign.
    const sum = (types: string[]) =>
      rows
        .filter((t) => types.includes(t.type) && t.status === "COMPLETED")
        .reduce((acc, t) => acc + Math.abs(t.amount), 0);
    return {
      deposited: sum(["DEPOSIT"]),
      withdrawn: sum(["WITHDRAW_APPROVED"]),
      wagered: sum(["BET"]),
      won: sum(["PAYOUT"]),
    };
  }, [txData]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "wallet", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "user-tx-totals", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const adjust = useMutation({
    mutationFn: (signedCents: number) =>
      WalletsAdminApi.adjustWallet(userId, {
        amount: signedCents,
        account: "MAIN",
        reason: reason.trim(),
        observation: `Ajuste manual via perfil do usuário (${signedCents > 0 ? "adição" : "remoção"} de saldo)`,
      }),
    onSuccess: () => {
      toast.success("Saldo ajustado");
      setAmount("");
      setReason("");
      setConfirming(null);
      invalidate();
    },
    // wallet-api declares its OWN ApiError class, so `instanceof ApiError`
    // (imported from identity-api) would never match here — Error is the
    // common base both envelope wrappers actually share.
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao ajustar saldo"),
  });

  const toggleDemo = useMutation({
    mutationFn: () => IdentityAdminApi.setUserDemoFlag(userId, !isDemo),
    onSuccess: () => {
      toast.success(isDemo ? "Conta Demo removida" : "Conta marcada como Demo");
      setConfirming(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao alterar tipo da conta"),
  });

  if (isLoading || !data) return <DrawerSkeleton rows={5} />;

  const balances = data.data.balances;
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  const amountValid = Number.isFinite(cents) && cents > 0;
  const reasonValid = reason.trim().length >= 3;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DetailRow label="Saldo principal" value={<span className="tabular-nums">{formatCurrency(balances.main / 100)}</span>} />
        <DetailRow label="Saldo bônus" value={<span className="tabular-nums">{formatCurrency(balances.bonus / 100)}</span>} />
        <DetailRow label="Saldo bloqueado" value={<span className="tabular-nums">{formatCurrency(balances.locked / 100)}</span>} />
        <DetailRow label="Total depositado" value={<span className="tabular-nums">{formatCurrency(totals.deposited / 100)}</span>} />
        <DetailRow label="Total sacado" value={<span className="tabular-nums">{formatCurrency(totals.withdrawn / 100)}</span>} />
        <DetailRow label="Total apostado" value={<span className="tabular-nums">{formatCurrency(totals.wagered / 100)}</span>} />
        <DetailRow label="Total ganho" value={<span className="tabular-nums">{formatCurrency(totals.won / 100)}</span>} />
        <DetailRow
          label="Total perdido"
          value={<span className="tabular-nums">{formatCurrency(Math.max(0, totals.wagered - totals.won) / 100)}</span>}
        />
      </div>

      {txData?.truncated && (
        <p className="rounded-lg border border-warning/40 bg-warning/[0.06] p-2.5 text-xs text-text-secondary">
          Esta conta tem mais de {TX_PAGE_SIZE * TX_MAX_PAGES} transações — os totais acima cobrem apenas as mais
          recentes. Use a tela de Transações para o número fechado.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">Ajustar saldo</p>
        <Input
          aria-label="Valor (R$)"
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor (R$)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          aria-label="Motivo"
          placeholder="Motivo (obrigatório, vai para a auditoria)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {confirming === "add" || confirming === "remove" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/[0.06] p-2.5">
            <p className="text-xs text-text-secondary">
              Confirmar {confirming === "add" ? "adição" : "remoção"} de{" "}
              <strong className="tabular-nums">{formatCurrency(cents / 100)}</strong>
              {confirming === "remove" && cents > balances.main && (
                <> — maior que o saldo principal atual, a operação será recusada pelo backend.</>
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant={confirming === "add" ? "success" : "danger"}
                size="sm"
                className="flex-1"
                loading={adjust.isPending}
                onClick={() => adjust.mutate(confirming === "add" ? cents : -cents)}
              >
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" className="border border-border" onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="success"
              size="sm"
              disabled={!amountValid || !reasonValid}
              onClick={() => setConfirming("add")}
            >
              <Plus className="size-4" /> Adicionar
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!amountValid || !reasonValid}
              onClick={() => setConfirming("remove")}
            >
              <Minus className="size-4" /> Remover
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">Tipo da conta</p>
        <p className="text-xs text-text-secondary">
          Contas Demo ficam isoladas da operação real: não aparecem no ledger nem nos relatórios financeiros. Por
          isso a conversão só é permitida enquanto a conta não tiver depósito, saque ou aposta — depois disso,
          mudar o tipo reescreveria números já contabilizados.
        </p>
        {confirming === "demo" ? (
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" loading={toggleDemo.isPending} onClick={() => toggleDemo.mutate()}>
              Confirmar
            </Button>
            <Button variant="ghost" size="sm" className="border border-border" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirming("demo")}>
            <FlaskConical className="size-4" /> {isDemo ? "Remover Conta Demo" : "Transformar em Conta Demo"}
          </Button>
        )}
      </div>

      <p className="text-[11px] text-text-muted">
        Toda ação aqui grava uma linha imutável em AuditLog (autor, antes/depois, IP) e uma transação rastreável na
        carteira.
      </p>
    </div>
  );
}

const AFFILIATE_STATUS_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDING: { label: "Pendente", tone: "warning" },
  APPROVED: { label: "Aprovado", tone: "success" },
  REJECTED: { label: "Recusado", tone: "danger" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
  DOCUMENTS_REQUESTED: { label: "Documentos pendentes", tone: "info" },
};

/**
 * Signup no longer creates an AffiliateProfile automatically — `affiliate`
 * is `null` here for every regular account until an admin explicitly
 * promotes it. "Transformar em afiliado" is that explicit promotion, via
 * AffiliateService.adminCreateDirect — always creates a DIRECT affiliate (no
 * manager), never a duplicate for an account that already has one.
 */
function UserAffiliateTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [editingCommission, setEditingCommission] = useState(false);
  const [commissionInput, setCommissionInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-affiliate", userId],
    queryFn: () => AffiliateApplicationsAdminApi.getByUserId(userId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "user-affiliate", userId] });

  const createDirect = useMutation({
    mutationFn: () => AffiliateApplicationsAdminApi.createDirect(userId),
    onSuccess: () => {
      toast.success("Usuário transformado em Afiliado Direto");
      setConfirmingCreate(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao transformar em afiliado"),
  });

  const updateCommission = useMutation({
    mutationFn: (input: { affiliateId: string; percent: number }) =>
      AffiliateApplicationsAdminApi.updateCommission(input.affiliateId, input.percent),
    onSuccess: () => {
      toast.success("Comissão atualizada");
      setEditingCommission(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao atualizar comissão"),
  });

  if (isLoading) return <DrawerSkeleton rows={3} />;

  const affiliate: AffiliateProfileAdminDto | null = data?.data ?? null;

  if (!affiliate) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <p className="text-sm text-text-secondary">Este usuário ainda não é afiliado.</p>
        {confirmingCreate ? (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/[0.06] p-2.5">
            <p className="text-xs text-text-secondary">
              O usuário será transformado em <strong>Afiliado Direto</strong> (sem gerente), com comissão inicial de{" "}
              <strong>5%</strong>.
            </p>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                loading={createDirect.isPending}
                onClick={() => createDirect.mutate()}
              >
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" className="border border-border" onClick={() => setConfirmingCreate(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirmingCreate(true)}>
            <UserPlus className="size-4" /> Transformar em afiliado
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DetailRow
          label="Tipo"
          value={
            affiliate.managerName ? (
              <StatusBadge tone="info">Afiliado Gerenciado</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Afiliado Direto</StatusBadge>
            )
          }
        />
        <DetailRow
          label="Status"
          value={
            <StatusBadge tone={AFFILIATE_STATUS_LABEL[affiliate.status]?.tone ?? "neutral"}>
              {AFFILIATE_STATUS_LABEL[affiliate.status]?.label ?? affiliate.status}
            </StatusBadge>
          }
        />
        <DetailRow label="Gerente" value={affiliate.managerName ?? "Nenhum / Direto"} />
        <DetailRow label="Aprovado em" value={formatDate(affiliate.approvedAt)} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">Comissão</p>
        {editingCommission ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-purple/60 tabular-nums"
                autoFocus
              />
              <span className="text-sm text-text-muted">%</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                loading={updateCommission.isPending}
                disabled={commissionInput.trim() === "" || Number.isNaN(Number(commissionInput))}
                onClick={() => updateCommission.mutate({ affiliateId: affiliate.id, percent: Number(commissionInput) })}
              >
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" className="border border-border" onClick={() => setEditingCommission(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold tabular-nums">
              {affiliate.commissionPercent !== null ? `${affiliate.commissionPercent}%` : "5% (padrão)"}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCommissionInput(String(affiliate.commissionPercent ?? 5));
                setEditingCommission(true);
              }}
            >
              Editar comissão
            </Button>
          </div>
        )}
      </div>
    </div>
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

  if (isLoading) return <DrawerSkeleton rows={3} />;
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

  if (isLoading) return <DrawerSkeleton rows={3} />;
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
