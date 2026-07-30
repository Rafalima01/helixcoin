"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, Drawer, DetailRow, type TableColumn } from "@/components/admin/ui";
import { PaymentLogsAdminApi } from "@/lib/admin/payments-api";
import type { GatewayLogAdminDto } from "@/modules/payments/dto/payments.dto";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export default function AdminPaymentLogsPage() {
  return (
    <Suspense fallback={null}>
      <AdminPaymentLogsPageInner />
    </Suspense>
  );
}

function AdminPaymentLogsPageInner() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Deep link from the Gateways screen's "Ver logs" button — cleared locally via the "limpar" button below, not by editing the URL.
  const [gatewayCredentialId, setGatewayCredentialId] = useState<string | undefined>(
    searchParams.get("gatewayCredentialId") ?? undefined
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "logs", direction, gatewayCredentialId],
    queryFn: () =>
      PaymentLogsAdminApi.list({
        direction: direction === "all" ? undefined : (direction as "outbound" | "inbound"),
        gatewayCredentialId,
        page: 1,
        pageSize: 100,
      }),
  });

  const rows = (data?.data ?? []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.endpoint.toLowerCase().includes(q) || (l.correlationId ?? "").toLowerCase().includes(q);
  });

  const columns: TableColumn<GatewayLogAdminDto>[] = [
    {
      key: "success",
      header: "Resultado",
      render: (l) => <StatusBadge tone={l.success ? "success" : "danger"}>{l.success ? "Sucesso" : "Falha"}</StatusBadge>,
    },
    { key: "direction", header: "Direção", render: (l) => (l.direction === "outbound" ? "Saída" : "Entrada") },
    { key: "provider", header: "Provedor", render: (l) => <span className="text-text-secondary">{l.provider ?? "—"}</span> },
    { key: "endpoint", header: "Endpoint", render: (l) => <code className="text-xs">{l.endpoint}</code> },
    { key: "correlationId", header: "Correlação", render: (l) => <code className="text-xs text-text-muted">{l.correlationId ?? "—"}</code> },
    {
      key: "statusCode",
      header: "Status HTTP",
      align: "right",
      render: (l) => <span className="text-xs tabular-nums">{l.statusCode ?? "—"}</span>,
    },
    {
      key: "durationMs",
      header: "Duração",
      align: "right",
      render: (l) => <span className="text-xs text-text-muted tabular-nums">{l.durationMs !== null ? `${l.durationMs}ms` : "—"}</span>,
    },
    {
      key: "createdAt",
      header: "Data/Hora",
      align: "right",
      render: (l) => <span className="text-xs text-text-muted tabular-nums">{formatDate(l.createdAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Logs de Pagamento"
        description="Toda chamada a um gateway (saída) e todo webhook recebido (entrada) — nunca inclui credenciais ou segredos."
      />
      {gatewayCredentialId && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          Filtrando por gateway <code className="text-[11px]">{gatewayCredentialId}</code>
          <button className="text-purple hover:underline" onClick={() => setGatewayCredentialId(undefined)}>
            limpar
          </button>
        </div>
      )}
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por endpoint ou correlationId...">
        <FilterChips
          value={direction}
          onChange={setDirection}
          options={[
            { value: "all", label: "Todos" },
            { value: "outbound", label: "Saída" },
            { value: "inbound", label: "Entrada" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15} onRowClick={(l) => setSelectedId(l.id)} />

      {selectedId && <LogDrawer log={rows.find((l) => l.id === selectedId) ?? null} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function LogDrawer({ log, onClose }: { log: GatewayLogAdminDto | null; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} title="Log de Gateway">
      {!log ? (
        <p className="text-sm text-text-muted">Registro não encontrado.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <DetailRow label="ID" value={<code className="text-xs">{log.id}</code>} />
            <DetailRow label="Direção" value={log.direction === "outbound" ? "Saída" : "Entrada"} />
            <DetailRow label="Provedor" value={log.provider ?? "—"} />
            <DetailRow label="Endpoint" value={<code className="text-xs">{log.endpoint}</code>} />
            <DetailRow label="Método" value={log.method ?? "—"} />
            <DetailRow label="Correlação" value={<code className="text-xs">{log.correlationId ?? "—"}</code>} />
            <DetailRow label="Status HTTP" value={log.statusCode !== null ? String(log.statusCode) : "—"} />
            <DetailRow label="Duração" value={log.durationMs !== null ? `${log.durationMs}ms` : "—"} />
            <DetailRow label="Criado em" value={formatDate(log.createdAt)} />
            {log.errorMessage && <DetailRow label="Erro" value={log.errorMessage} />}
          </div>

          {log.requestSummary && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-text-muted">Resumo da requisição (sanitizado)</p>
              <pre className="max-h-40 overflow-auto rounded-xl border border-border bg-white/[0.02] p-3 text-[11px] text-text-secondary">
                {JSON.stringify(log.requestSummary, null, 2)}
              </pre>
            </div>
          )}

          {log.responseSummary && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-text-muted">Resumo da resposta (sanitizado)</p>
              <pre className="max-h-40 overflow-auto rounded-xl border border-border bg-white/[0.02] p-3 text-[11px] text-text-secondary">
                {JSON.stringify(log.responseSummary, null, 2)}
              </pre>
            </div>
          )}

          <p className="text-[11px] text-text-muted">
            Credenciais e segredos de webhook nunca são registrados aqui — apenas metadados sanitizados da chamada.
          </p>
        </div>
      )}
    </Drawer>
  );
}
