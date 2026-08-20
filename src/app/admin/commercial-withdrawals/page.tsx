"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  DataTable,
  FilterBar,
  FilterChips,
  StatusBadge,
  Drawer,
  DetailRow,
  DrawerSkeleton,
  KpiCard,
  KpiGridSkeleton,
  type TableColumn,
} from "@/components/admin/ui";
import { CommercialWithdrawalsAdminApi, ApiError } from "@/lib/admin/commercial-withdrawals-api";
import type { CommercialWithdrawAdminDto } from "@/modules/commercial-withdrawals/dto/commercial-withdraw.dto";
import { formatCurrency } from "@/lib/utils";

function formatCents(cents: number) {
  return formatCurrency(cents / 100);
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDING: { label: "Aguardando aprovação", tone: "warning" },
  APPROVED: { label: "Aprovado", tone: "success" },
  REJECTED: { label: "Rejeitado", tone: "danger" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
};

const PAYEE_ROLE: Record<string, { label: string; tone: "info" | "pink" }> = {
  AFFILIATE: { label: "Afiliado", tone: "info" },
  MANAGER: { label: "Gerente", tone: "pink" },
};

/** "Vínculo" summarized for the main table — derived entirely from the hierarchy fields the backend already resolved (AffiliateProfile.managerId -> ManagerProfile / ManagerProfile's affiliate count), never invented client-side. */
function bondLabel(w: CommercialWithdrawAdminDto): string {
  if (w.payeeRole === "MANAGER") {
    return w.affiliateCount === null ? "—" : `${w.affiliateCount} afiliado${w.affiliateCount === 1 ? "" : "s"}`;
  }
  if (w.isDirectAffiliate) return "Direto";
  return w.managerName ? `Gerente: ${w.managerName}` : "Gerente";
}

type PeriodPreset = "all" | "today" | "7d" | "30d" | "custom";

/** Converts a period preset into `from`/`to` ISO strings applied to CommercialWithdraw.createdAt server-side — never a client-side-only filter (see the audit's explicit "não crie filtro client-side se o backend puder" instruction). */
function resolvePeriodRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string
): { from?: string; to?: string } {
  const now = new Date();
  switch (preset) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case "7d":
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
    case "custom":
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined,
        to: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : undefined,
      };
    default:
      return {};
  }
}

export default function AdminCommercialWithdrawalsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payeeRole, setPayeeRole] = useState("all");
  const [bond, setBond] = useState("all");
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { from, to } = useMemo(() => resolvePeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const listParams = {
    status: status === "all" ? undefined : status,
    payeeRole: payeeRole === "all" ? undefined : payeeRole,
    bond: bond === "all" ? undefined : bond,
    from,
    to,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "commercial-withdrawals", listParams],
    queryFn: () => CommercialWithdrawalsAdminApi.list({ ...listParams, page: 1, pageSize: 100 }),
  });

  // Same filters as the list, minus status/page — the cards enumerate every
  // status themselves, so they must never be scoped to just one of them.
  const summaryParams = { payeeRole: listParams.payeeRole, bond: listParams.bond, from, to };
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["admin", "commercial-withdrawals", "summary", summaryParams],
    queryFn: () => CommercialWithdrawalsAdminApi.getSummary(summaryParams),
  });

  const rows = (data?.data ?? []).filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return w.userName.toLowerCase().includes(q) || w.userEmail.toLowerCase().includes(q) || w.id.includes(q);
  });

  const columns: TableColumn<CommercialWithdrawAdminDto>[] = [
    {
      key: "status",
      header: "Status",
      render: (w) => <StatusBadge tone={STATUS[w.status]?.tone ?? "neutral"}>{STATUS[w.status]?.label ?? w.status}</StatusBadge>,
    },
    {
      key: "user",
      header: "Solicitante",
      render: (w) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{w.userName}</p>
          <p className="text-xs text-text-muted truncate">{w.userEmail}</p>
        </div>
      ),
    },
    {
      key: "payeeRole",
      header: "Tipo",
      render: (w) => <StatusBadge tone={PAYEE_ROLE[w.payeeRole]?.tone ?? "neutral"}>{PAYEE_ROLE[w.payeeRole]?.label ?? w.payeeRole}</StatusBadge>,
    },
    {
      key: "bond",
      header: "Vínculo",
      render: (w) => <span className="text-text-secondary">{bondLabel(w)}</span>,
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      render: (w) => <span className="font-semibold tabular-nums">{formatCents(w.amountCents)}</span>,
    },
    {
      key: "requestedAt",
      header: "Solicitado",
      align: "right",
      render: (w) => <span className="text-xs text-text-muted tabular-nums">{formatDate(w.requestedAt)}</span>,
    },
  ];

  const kpis = summaryData
    ? [
        { id: "pending", label: "Saques pendentes", value: formatCents(summaryData.data.pendingCents) },
        { id: "requested", label: "Total solicitado", value: formatCents(summaryData.data.totalRequestedCents) },
        { id: "paid", label: "Total pago", value: formatCents(summaryData.data.paidCents) },
        { id: "count", label: "Quantidade de solicitações", value: summaryData.data.count.toLocaleString("pt-BR") },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Saques Comerciais"
        description="Fila de aprovação de saques de comissão — Afiliados e Gerentes. Sempre revisado manualmente, nunca automático."
      />

      {summaryLoading ? (
        <KpiGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} />
          ))}
        </div>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por nome, email ou ID...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "PENDING", label: "Aguardando" },
            { value: "APPROVED", label: "Aprovados" },
            { value: "REJECTED", label: "Rejeitados" },
          ]}
        />
      </FilterBar>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Tipo</span>
          <FilterChips
            value={payeeRole}
            onChange={setPayeeRole}
            options={[
              { value: "all", label: "Todos" },
              { value: "AFFILIATE", label: "Afiliados" },
              { value: "MANAGER", label: "Gerentes" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Vínculo</span>
          <FilterChips
            value={bond}
            onChange={setBond}
            options={[
              { value: "all", label: "Todos" },
              { value: "DIRECT", label: "Afiliados diretos" },
              { value: "MANAGED", label: "Afiliados de gerente" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Período</span>
          <FilterChips
            value={period}
            onChange={(v) => setPeriod(v as PeriodPreset)}
            options={[
              { value: "all", label: "Todos" },
              { value: "today", label: "Hoje" },
              { value: "7d", label: "Últimos 7 dias" },
              { value: "30d", label: "Últimos 30 dias" },
              { value: "custom", label: "Personalizado" },
            ]}
          />
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-white/[0.03] px-2.5 py-1.5 text-xs outline-none focus:border-purple/60"
              />
              <span className="text-xs text-text-muted">até</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-white/[0.03] px-2.5 py-1.5 text-xs outline-none focus:border-purple/60"
              />
            </div>
          )}
        </div>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} error={isError} onRetry={refetch} pageSize={10} onRowClick={(w) => setSelectedId(w.id)} />

      {selectedId && <CommercialWithdrawDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

/** The hierarchy block from section 10 of the spec — "quem está pedindo, e a quem esse afiliado pertence" at a glance. Built entirely from CommercialWithdrawAdminDto's hierarchy fields (resolved server-side from the real AffiliateProfile/ManagerProfile relations). */
function HierarchySection({ w }: { w: CommercialWithdrawAdminDto }) {
  if (w.payeeRole === "MANAGER") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <StatusBadge tone="pink">Gerente</StatusBadge>
        </div>
        <DetailRow label="Nome" value={w.userName} />
        <DetailRow label="ID" value={<code className="text-xs">{w.userId}</code>} />
        <DetailRow
          label="Afiliados vinculados"
          value={w.affiliateCount === null ? "—" : `${w.affiliateCount} afiliado${w.affiliateCount === 1 ? "" : "s"}`}
        />
      </div>
    );
  }

  // AFFILIATE
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <StatusBadge tone="info">Afiliado</StatusBadge>
        <StatusBadge tone={w.isDirectAffiliate ? "neutral" : "pink"}>
          {w.isDirectAffiliate ? "Afiliado direto" : "Afiliado de gerente"}
        </StatusBadge>
      </div>
      <DetailRow label="Afiliado" value={w.userName} />
      <DetailRow label="ID do afiliado" value={<code className="text-xs">{w.userId}</code>} />
      {w.isDirectAffiliate ? (
        <DetailRow label="Gerente" value="Nenhum" />
      ) : (
        <>
          <DetailRow label="Gerente" value={w.managerName ?? "—"} />
          <DetailRow label="ID do gerente" value={<code className="text-xs">{w.managerId ?? "—"}</code>} />
        </>
      )}
    </div>
  );
}

function CommercialWithdrawDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "commercial-withdrawal", id],
    queryFn: () => CommercialWithdrawalsAdminApi.get(id),
  });
  const withdraw = data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "commercial-withdrawal", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "commercial-withdrawals"] });
  };

  const decide = useMutation({
    mutationFn: (input: { action: "APPROVE" | "REJECT"; reason?: string }) =>
      CommercialWithdrawalsAdminApi.decide(id, input.action, input.reason),
    onSuccess: (_res, input) => {
      toast.success(input.action === "APPROVE" ? "Saque aprovado" : "Saque rejeitado");
      setRejecting(false);
      setRejectionReason("");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao processar decisão"),
  });

  const isPending = withdraw?.status === "PENDING";

  return (
    <Drawer open onClose={onClose} title={withdraw ? "Saque Comercial" : "Carregando..."}>
      {isLoading || !withdraw ? (
        <DrawerSkeleton />
      ) : (
        <div className="flex flex-col gap-4">
          <HierarchySection w={withdraw} />

          <div>
            <DetailRow label="ID do saque" value={<code className="text-xs">{withdraw.id}</code>} />
            <DetailRow label="E-mail" value={withdraw.userEmail} />
            <DetailRow label="Status" value={<StatusBadge tone={STATUS[withdraw.status]?.tone ?? "neutral"}>{STATUS[withdraw.status]?.label ?? withdraw.status}</StatusBadge>} />
            <DetailRow label="Valor solicitado" value={<span className="font-semibold">{formatCents(withdraw.amountCents)}</span>} />
            <DetailRow label="Chave PIX" value={<code className="text-xs">{withdraw.pixKeyMasked}</code>} />
            <DetailRow label="Tipo de chave" value={withdraw.pixKeyType} />
            <DetailRow label="CPF do titular" value={<code className="text-xs">{withdraw.holderCpf}</code>} />
            <DetailRow label="Solicitado em" value={formatDate(withdraw.requestedAt)} />
            <DetailRow label="Decidido em" value={formatDate(withdraw.processedAt)} />
            {withdraw.rejectionReason && <DetailRow label="Motivo da rejeição" value={withdraw.rejectionReason} />}
          </div>

          {isPending && !rejecting && (
            <div className="flex gap-2">
              <Button
                variant="success"
                size="sm"
                loading={decide.isPending}
                onClick={() => decide.mutate({ action: "APPROVE" })}
                className="flex-1"
              >
                Aprovar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRejecting(true)} className="flex-1 border border-border">
                Rejeitar
              </Button>
            </div>
          )}

          {isPending && rejecting && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary">Motivo da rejeição</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Ex: chave PIX inválida"
                className="w-full rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-purple/60"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={decide.isPending}
                  disabled={rejectionReason.trim().length < 3}
                  onClick={() => decide.mutate({ action: "REJECT", reason: rejectionReason.trim() })}
                  className="flex-1"
                >
                  Confirmar rejeição
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} className="border border-border">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-text-muted">
            Aprovar debita o saldo bloqueado (LOCKED) e gera lançamento no Ledger — é o próprio pagamento, não existe uma
            etapa de processamento separada. Rejeitar apenas desbloqueia o valor de volta ao saldo principal do
            afiliado/gerente.
          </p>
        </div>
      )}
    </Drawer>
  );
}
