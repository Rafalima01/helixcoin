"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, Drawer, DetailRow, type TableColumn } from "@/components/admin/ui";
import { DepositsAdminApi, ApiError, type AdminDepositSimulateOutcome } from "@/lib/admin/payments-api";
import type { DepositAdminDto } from "@/modules/payments/dto/payments.dto";
import { formatCurrency } from "@/lib/utils";

function formatCents(cents: number) {
  return formatCurrency(cents / 100);
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDING: { label: "Aguardando pagamento", tone: "warning" },
  PROCESSING: { label: "Processando", tone: "info" },
  PAID: { label: "Pago", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
  REFUNDED: { label: "Estornado", tone: "neutral" },
  EXPIRED: { label: "Expirado", tone: "danger" },
};

export default function AdminDepositsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "deposits", status],
    queryFn: () => DepositsAdminApi.list({ status: status === "all" ? undefined : status, page: 1, pageSize: 100 }),
  });

  const rows = (data?.data ?? []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.userName.toLowerCase().includes(q) || d.userEmail.toLowerCase().includes(q) || d.id.includes(q);
  });

  const columns: TableColumn<DepositAdminDto>[] = [
    {
      key: "status",
      header: "Status",
      render: (d) => <StatusBadge tone={STATUS[d.status]?.tone ?? "neutral"}>{STATUS[d.status]?.label ?? d.status}</StatusBadge>,
    },
    {
      key: "user",
      header: "Jogador",
      render: (d) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{d.userName}</p>
          <p className="text-xs text-text-muted truncate">{d.userEmail}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      render: (d) => <span className="font-semibold tabular-nums text-green">{formatCents(d.amountCents)}</span>,
    },
    {
      key: "gateway",
      header: "Gateway",
      render: (d) => <span className="text-text-secondary">{d.gatewayName}</span>,
    },
    {
      key: "transactionId",
      header: "ID do provedor",
      render: (d) => <code className="text-xs text-text-muted">{d.providerTransactionId ?? "—"}</code>,
    },
    {
      key: "createdAt",
      header: "Criado",
      align: "right",
      render: (d) => <span className="text-xs text-text-muted tabular-nums">{formatDate(d.createdAt)}</span>,
    },
    {
      key: "confirmedAt",
      header: "Confirmado",
      align: "right",
      render: (d) => <span className="text-xs text-text-muted tabular-nums">{formatDate(d.confirmedAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Depósitos" description="Monitoramento de entradas via PIX em todos os gateways — dados reais via src/modules/payments." />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por jogador, email ou ID...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "PENDING", label: "Aguardando" },
            { value: "PAID", label: "Pagos" },
            { value: "FAILED", label: "Falhas" },
            { value: "EXPIRED", label: "Expirados" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={10} onRowClick={(d) => setSelectedId(d.id)} />

      {selectedId && <DepositDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

const SIMULATE_OUTCOMES_BY_STATUS: Record<string, { outcome: AdminDepositSimulateOutcome; label: string }[]> = {
  PENDING: [
    { outcome: "PAID", label: "Marcar como pago" },
    { outcome: "FAILED", label: "Marcar como falho" },
    { outcome: "CANCELLED", label: "Marcar como cancelado" },
    { outcome: "EXPIRED", label: "Marcar como expirado" },
  ],
  PAID: [{ outcome: "REFUNDED", label: "Estornar (só muda status, sem debitar saldo)" }],
};

function DepositDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "deposit", id],
    queryFn: () => DepositsAdminApi.get(id),
  });
  const deposit = data?.data;

  const simulate = useMutation({
    mutationFn: (outcome: AdminDepositSimulateOutcome) => DepositsAdminApi.simulate(id, outcome),
    onSuccess: () => {
      toast.success("Evento simulado processado");
      queryClient.invalidateQueries({ queryKey: ["admin", "payments", "deposit", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payments", "deposits"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao simular evento"),
  });

  const simulateOptions = deposit && deposit.gatewayProvider === "MOCK" ? (SIMULATE_OUTCOMES_BY_STATUS[deposit.status] ?? []) : [];

  return (
    <Drawer open onClose={onClose} title={deposit ? "Depósito" : "Carregando..."}>
      {isLoading || !deposit ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        <div>
          <DetailRow label="ID" value={<code className="text-xs">{deposit.id}</code>} />
          <DetailRow label="Status" value={<StatusBadge tone={STATUS[deposit.status]?.tone ?? "neutral"}>{STATUS[deposit.status]?.label ?? deposit.status}</StatusBadge>} />
          <DetailRow label="Jogador" value={`${deposit.userName} (${deposit.userEmail})`} />
          <DetailRow label="Valor" value={<span className="text-green font-bold">{formatCents(deposit.amountCents)}</span>} />
          <DetailRow label="Gateway" value={`${deposit.gatewayName} (${deposit.gatewayProvider})`} />
          <DetailRow label="ID do provedor" value={<code className="text-xs">{deposit.providerTransactionId ?? "—"}</code>} />
          <DetailRow label="Código PIX" value={<code className="text-[10px] break-all">{deposit.pixCode ?? "—"}</code>} />
          <DetailRow label="Expira em" value={formatDate(deposit.expiresAt)} />
          <DetailRow label="Criado em" value={formatDate(deposit.createdAt)} />
          <DetailRow label="Confirmado em" value={formatDate(deposit.confirmedAt)} />
          {deposit.failureReason && <DetailRow label="Motivo da falha" value={deposit.failureReason} />}

          {simulateOptions.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-sm font-semibold">Simulador (Fase 10 — gateway MOCK)</p>
              <div className="flex flex-col gap-2">
                {simulateOptions.map((opt) => (
                  <Button
                    key={opt.outcome}
                    variant="secondary"
                    size="sm"
                    loading={simulate.isPending}
                    onClick={() => simulate.mutate(opt.outcome)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-[11px] text-text-muted">
            Toda confirmação passa pelo webhook assinado do gateway → PaymentService → WalletService. Nenhum saldo é alterado diretamente — o simulador de estorno só muda o status do depósito.
          </p>
        </div>
      )}
    </Drawer>
  );
}
