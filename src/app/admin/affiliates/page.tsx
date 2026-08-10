"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  DataTable,
  FilterBar,
  FilterChips,
  StatusBadge,
  PriorityHint,
  Drawer,
  DetailRow,
  DrawerSkeleton,
  type TableColumn,
} from "@/components/admin/ui";
import { AffiliateApplicationsAdminApi, ManagersAdminApi, ApiError, type AffiliateDecisionAction } from "@/lib/admin/affiliate-api";
import type { AffiliateProfileAdminDto } from "@/modules/affiliate/dto/affiliate.dto";

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDING: { label: "Pendente", tone: "warning" },
  APPROVED: { label: "Aprovado", tone: "success" },
  REJECTED: { label: "Recusado", tone: "danger" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
  DOCUMENTS_REQUESTED: { label: "Documentos pendentes", tone: "info" },
};

export default function AdminAffiliatesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "affiliate", "applications", status],
    queryFn: () => AffiliateApplicationsAdminApi.list({ status: status === "all" ? undefined : status, page: 1, pageSize: 100 }),
  });

  const rows = (data?.data ?? []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.userName.toLowerCase().includes(q) || a.userEmail.toLowerCase().includes(q);
  });

  const columns: TableColumn<AffiliateProfileAdminDto>[] = [
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusBadge tone={STATUS[a.status]?.tone ?? "neutral"}>{STATUS[a.status]?.label ?? a.status}</StatusBadge>,
    },
    {
      key: "user",
      header: "Afiliado",
      render: (a) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{a.userName}</p>
          <p className="text-xs text-text-muted truncate">{a.userEmail}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      render: (a) =>
        a.managerName ? (
          <StatusBadge tone="info">Gerenciado</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Direto</StatusBadge>
        ),
    },
    {
      key: "manager",
      header: "Gerente",
      render: (a) => <span className="text-text-secondary">{a.managerName ?? "Nenhum / Direto"}</span>,
    },
    {
      key: "priority",
      header: "Prioridade",
      render: (a) =>
        a.status === "PENDING" || a.status === "DOCUMENTS_REQUESTED" ? (
          <PriorityHint since={a.requestedAt} />
        ) : (
          <span className="text-xs text-text-muted">—</span>
        ),
    },
    {
      key: "requestedAt",
      header: "Solicitado",
      align: "right",
      render: (a) => <span className="text-xs text-text-muted tabular-nums">{formatDate(a.requestedAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Afiliados"
        description="Cadastros, aprovações e vínculo com gerentes — dados reais via src/modules/affiliate."
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por nome ou email...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "PENDING", label: "Pendentes" },
            { value: "APPROVED", label: "Aprovados" },
            { value: "REJECTED", label: "Recusados" },
            { value: "BLOCKED", label: "Bloqueados" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={isLoading} error={isError} onRetry={refetch} pageSize={10} onRowClick={(a) => setSelectedId(a.id)} />

      {selectedId && <AffiliateDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function AffiliateDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [deciding, setDeciding] = useState<AffiliateDecisionAction | null>(null);
  const [reason, setReason] = useState("");
  const [managerId, setManagerId] = useState("");
  const [editingCommission, setEditingCommission] = useState(false);
  const [commissionInput, setCommissionInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "affiliate", "application", id],
    queryFn: () => AffiliateApplicationsAdminApi.get(id),
  });
  const affiliate = data?.data;

  const { data: managersData } = useQuery({
    queryKey: ["admin", "manager", "list-for-assign"],
    queryFn: () => ManagersAdminApi.list({ page: 1, pageSize: 100 }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "affiliate", "application", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "affiliate", "applications"] });
  };

  const decide = useMutation({
    mutationFn: (input: { action: AffiliateDecisionAction; reason?: string }) =>
      AffiliateApplicationsAdminApi.decide(id, input.action, input.reason),
    onSuccess: () => {
      toast.success("Decisão aplicada");
      setDeciding(null);
      setReason("");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao processar decisão"),
  });

  const assignManager = useMutation({
    mutationFn: (mid: string | null) => AffiliateApplicationsAdminApi.assignManager(id, mid),
    onSuccess: () => {
      toast.success("Gerente atualizado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao atribuir gerente"),
  });

  const updateCommission = useMutation({
    mutationFn: (percent: number) => AffiliateApplicationsAdminApi.updateCommission(id, percent),
    onSuccess: () => {
      toast.success("Comissão atualizada");
      setEditingCommission(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao atualizar comissão"),
  });

  const needsReason = deciding === "REJECT" || deciding === "BLOCK" || deciding === "REQUEST_DOCUMENTS";
  const canDecide = affiliate && (affiliate.status !== "APPROVED" || deciding === "BLOCK");

  return (
    <Drawer open onClose={onClose} title={affiliate ? "Afiliado" : "Carregando..."}>
      {isLoading || !affiliate ? (
        <DrawerSkeleton />
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <DetailRow label="ID" value={<code className="text-xs">{affiliate.id}</code>} />
            <DetailRow label="Status" value={<StatusBadge tone={STATUS[affiliate.status]?.tone ?? "neutral"}>{STATUS[affiliate.status]?.label ?? affiliate.status}</StatusBadge>} />
            <DetailRow label="Nome" value={affiliate.userName} />
            <DetailRow label="Email" value={affiliate.userEmail} />
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
            <DetailRow label="Gerente" value={affiliate.managerName ?? "Nenhum / Direto"} />
            <DetailRow label="Solicitado em" value={formatDate(affiliate.requestedAt)} />
            <DetailRow label="Aprovado em" value={formatDate(affiliate.approvedAt)} />
            {affiliate.rejectionReason && <DetailRow label="Motivo da recusa" value={affiliate.rejectionReason} />}
            {affiliate.blockedReason && <DetailRow label="Motivo do bloqueio" value={affiliate.blockedReason} />}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Comissão</label>
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
                    onClick={() => updateCommission.mutate(Number(commissionInput))}
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

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Atribuir gerente</label>
            <div className="flex gap-2">
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-purple/60"
              >
                <option value="">Nenhum</option>
                {(managersData?.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.userName} ({m.inviteCode})
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                loading={assignManager.isPending}
                onClick={() => assignManager.mutate(managerId || null)}
              >
                Atribuir
              </Button>
            </div>
          </div>

          {canDecide && !deciding && (
            <div className="flex flex-wrap gap-2">
              <Button variant="success" size="sm" onClick={() => decide.mutate({ action: "APPROVE" })} loading={decide.isPending}>
                Aprovar
              </Button>
              <Button variant="ghost" size="sm" className="border border-border" onClick={() => setDeciding("REJECT")}>
                Recusar
              </Button>
              <Button variant="ghost" size="sm" className="border border-border" onClick={() => setDeciding("REQUEST_DOCUMENTS")}>
                Pedir documentos
              </Button>
              {affiliate.status === "APPROVED" && (
                <Button variant="danger" size="sm" onClick={() => setDeciding("BLOCK")}>
                  Bloquear
                </Button>
              )}
            </div>
          )}

          {needsReason && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-secondary">Motivo</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo"
                className="w-full rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-purple/60"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={decide.isPending}
                  disabled={reason.trim().length < 3}
                  onClick={() => decide.mutate({ action: deciding!, reason: reason.trim() })}
                  className="flex-1"
                >
                  Confirmar
                </Button>
                <Button variant="ghost" size="sm" className="border border-border" onClick={() => setDeciding(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
