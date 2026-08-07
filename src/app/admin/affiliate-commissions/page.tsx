"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, Drawer, DetailRow, type TableColumn } from "@/components/admin/ui";
import { AffiliateCommissionsAdminApi, ApiError } from "@/lib/admin/affiliate-api";
import type { CommissionAdminDto } from "@/modules/affiliate/dto/affiliate.dto";
import { formatCurrency } from "@/lib/utils";

function formatCents(cents: number) {
  return formatCurrency(cents / 100);
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  AVAILABLE: { label: "Disponível", tone: "success" },
  LOCKED: { label: "Bloqueada", tone: "warning" },
  REJECTED: { label: "Rejeitada", tone: "danger" },
};

const SOURCE_LABEL: Record<string, string> = {
  REVSHARE_DEPOSIT: "RevShare",
  CPA_FTD: "CPA",
};

export default function AdminAffiliateCommissionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "affiliate", "commissions", status],
    queryFn: () => AffiliateCommissionsAdminApi.list({ status: status === "all" ? undefined : status, page: 1, pageSize: 100 }),
  });

  const rows = (data?.data ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.affiliateName.toLowerCase().includes(q) || c.affiliateEmail.toLowerCase().includes(q);
  });

  const columns: TableColumn<CommissionAdminDto>[] = [
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge tone={STATUS[c.status]?.tone ?? "warning"}>{STATUS[c.status]?.label ?? c.status}</StatusBadge>,
    },
    {
      key: "affiliate",
      header: "Afiliado",
      render: (c) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{c.affiliateName}</p>
          <p className="text-xs text-text-muted truncate">{c.affiliateEmail}</p>
        </div>
      ),
    },
    {
      key: "level",
      header: "Nível",
      align: "center",
      render: (c) => <span className="tabular-nums">{c.level}</span>,
    },
    {
      key: "source",
      header: "Origem",
      render: (c) => <span className="text-text-secondary">{SOURCE_LABEL[c.sourceType] ?? c.sourceType}</span>,
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      render: (c) => <span className="font-semibold tabular-nums text-green">{formatCents(c.amountCents)}</span>,
    },
    {
      key: "createdAt",
      header: "Gerado em",
      align: "right",
      render: (c) => <span className="text-xs text-text-muted tabular-nums">{formatDate(c.createdAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Comissões de Afiliados"
        description="Toda comissão gera Ledger — aprovar desbloqueia (LOCKED → MAIN), rejeitar reverte o crédito."
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por afiliado...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todas" },
            { value: "LOCKED", label: "Bloqueadas" },
            { value: "AVAILABLE", label: "Disponíveis" },
            { value: "REJECTED", label: "Rejeitadas" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={isLoading} error={isError} onRetry={refetch} pageSize={10} onRowClick={(c) => setSelectedId(c.id)} />

      {selectedId && <CommissionDrawer id={selectedId} row={rows.find((r) => r.id === selectedId)!} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function CommissionDrawer({ id, row, onClose }: { id: string; row: CommissionAdminDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const decide = useMutation({
    mutationFn: (input: { action: "APPROVE" | "REJECT"; reason?: string }) =>
      AffiliateCommissionsAdminApi.decide(id, input.action, input.reason),
    onSuccess: (_res, input) => {
      toast.success(input.action === "APPROVE" ? "Comissão aprovada" : "Comissão rejeitada");
      setRejecting(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "affiliate", "commissions"] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao processar decisão"),
  });

  const isLocked = row.status === "LOCKED";

  return (
    <Drawer open onClose={onClose} title="Comissão">
      <div className="flex flex-col gap-4">
        <div>
          <DetailRow label="ID" value={<code className="text-xs">{row.id}</code>} />
          <DetailRow label="Status" value={<StatusBadge tone={STATUS[row.status]?.tone ?? "warning"}>{STATUS[row.status]?.label ?? row.status}</StatusBadge>} />
          <DetailRow label="Afiliado" value={`${row.affiliateName} (${row.affiliateEmail})`} />
          <DetailRow label="Nível" value={String(row.level)} />
          <DetailRow label="Origem" value={SOURCE_LABEL[row.sourceType] ?? row.sourceType} />
          <DetailRow label="Jogador de origem" value={row.originUserName} />
          <DetailRow label="Valor" value={formatCents(row.amountCents)} />
          {row.percentApplied != null && <DetailRow label="Percentual aplicado" value={`${(row.percentApplied * 100).toFixed(1)}%`} />}
          <DetailRow label="Gerado em" value={formatDate(row.createdAt)} />
          <DetailRow label="Aprovado em" value={formatDate(row.approvedAt)} />
          {row.rejectionReason && <DetailRow label="Motivo da rejeição" value={row.rejectionReason} />}
        </div>

        {isLocked && !rejecting && (
          <div className="flex gap-2">
            <Button variant="success" size="sm" loading={decide.isPending} onClick={() => decide.mutate({ action: "APPROVE" })} className="flex-1">
              Aprovar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(true)} className="flex-1 border border-border">
              Rejeitar
            </Button>
          </div>
        )}

        {isLocked && rejecting && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Motivo da rejeição</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ex: depósito estornado"
              className="w-full rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-purple/60"
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={decide.isPending}
                disabled={reason.trim().length < 3}
                onClick={() => decide.mutate({ action: "REJECT", reason: reason.trim() })}
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
      </div>
    </Drawer>
  );
}
