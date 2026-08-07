"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, Drawer, DetailRow, DrawerSkeleton, type TableColumn } from "@/components/admin/ui";
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

export default function AdminCommercialWithdrawalsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "commercial-withdrawals", status],
    queryFn: () => CommercialWithdrawalsAdminApi.list({ status: status === "all" ? undefined : status, page: 1, pageSize: 100 }),
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
      header: "Nome",
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
      key: "amount",
      header: "Valor",
      align: "right",
      render: (w) => <span className="font-semibold tabular-nums">{formatCents(w.amountCents)}</span>,
    },
    {
      key: "pix",
      header: "Chave PIX",
      render: (w) => <code className="text-xs text-text-secondary">{w.pixKeyMasked}</code>,
    },
    {
      key: "holderCpf",
      header: "CPF do titular",
      render: (w) => <code className="text-xs text-text-secondary">{w.holderCpf}</code>,
    },
    {
      key: "requestedAt",
      header: "Solicitado",
      align: "right",
      render: (w) => <span className="text-xs text-text-muted tabular-nums">{formatDate(w.requestedAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Saques Comerciais"
        description="Fila de aprovação de saques de comissão — Afiliados e Gerentes. Sempre revisado manualmente, nunca automático."
      />
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
      <DataTable columns={columns} rows={rows} loading={isLoading} error={isError} onRetry={refetch} pageSize={10} onRowClick={(w) => setSelectedId(w.id)} />

      {selectedId && <CommercialWithdrawDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
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
          <div>
            <DetailRow label="ID" value={<code className="text-xs">{withdraw.id}</code>} />
            <DetailRow label="Status" value={<StatusBadge tone={STATUS[withdraw.status]?.tone ?? "neutral"}>{STATUS[withdraw.status]?.label ?? withdraw.status}</StatusBadge>} />
            <DetailRow label="Tipo" value={<StatusBadge tone={PAYEE_ROLE[withdraw.payeeRole]?.tone ?? "neutral"}>{PAYEE_ROLE[withdraw.payeeRole]?.label ?? withdraw.payeeRole}</StatusBadge>} />
            <DetailRow label="Nome" value={`${withdraw.userName} (${withdraw.userEmail})`} />
            <DetailRow label="Valor" value={formatCents(withdraw.amountCents)} />
            <DetailRow label="Chave PIX" value={<code className="text-xs">{withdraw.pixKeyMasked}</code>} />
            <DetailRow label="Tipo de chave" value={withdraw.pixKeyType} />
            <DetailRow label="CPF do titular" value={<code className="text-xs">{withdraw.holderCpf}</code>} />
            <DetailRow label="Solicitado em" value={formatDate(withdraw.requestedAt)} />
            <DetailRow label="Processado em" value={formatDate(withdraw.processedAt)} />
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
            Aprovar debita o saldo bloqueado (LOCKED) e gera lançamento no Ledger. Rejeitar apenas desbloqueia o
            valor de volta ao saldo principal do afiliado/gerente.
          </p>
        </div>
      )}
    </Drawer>
  );
}
