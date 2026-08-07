"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, FilterBar, FilterChips, StatusBadge, Drawer, DetailRow, JsonViewer, DrawerSkeleton, type TableColumn } from "@/components/admin/ui";
import { WebhooksAdminApi, ApiError } from "@/lib/admin/payments-api";
import type { PaymentWebhookAdminDto } from "@/modules/payments/dto/payments.dto";

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  RECEIVED: { label: "Recebido", tone: "info" },
  PROCESSED: { label: "Processado", tone: "success" },
  ERROR: { label: "Erro", tone: "danger" },
  REPROCESSED: { label: "Reprocessado", tone: "success" },
};

export default function AdminWebhooksPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "payments", "webhooks", status],
    queryFn: () => WebhooksAdminApi.list({ status: status === "all" ? undefined : status, page: 1, pageSize: 100 }),
  });

  const rows = (data?.data ?? []).filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return w.relatedId.toLowerCase().includes(q) || w.eventType.toLowerCase().includes(q) || w.id.includes(q);
  });

  const columns: TableColumn<PaymentWebhookAdminDto>[] = [
    {
      key: "status",
      header: "Status",
      render: (w) => <StatusBadge tone={STATUS[w.status]?.tone ?? "neutral"}>{STATUS[w.status]?.label ?? w.status}</StatusBadge>,
    },
    { key: "provider", header: "Provedor", render: (w) => <span className="text-text-secondary">{w.provider}</span> },
    { key: "eventType", header: "Evento", render: (w) => <code className="text-xs">{w.eventType}</code> },
    {
      key: "related",
      header: "Relacionado",
      render: (w) => (
        <span className="text-xs text-text-muted">
          {w.relatedType} <code>{w.relatedId}</code>
        </span>
      ),
    },
    {
      key: "signatureValid",
      header: "Assinatura",
      render: (w) => (
        <StatusBadge tone={w.signatureValid ? "success" : "danger"}>{w.signatureValid ? "Válida" : "Inválida"}</StatusBadge>
      ),
    },
    {
      key: "receivedAt",
      header: "Recebido",
      align: "right",
      render: (w) => <span className="text-xs text-text-muted tabular-nums">{formatDate(w.receivedAt)}</span>,
    },
    {
      key: "processingMs",
      header: "Tempo",
      align: "right",
      render: (w) => <span className="text-xs text-text-muted tabular-nums">{w.processingMs !== null ? `${w.processingMs}ms` : "—"}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Webhooks de Pagamento"
        description="Entregas recebidas dos gateways — assinatura, idempotência e tempo de processamento auditados."
      />
      <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por evento ou ID relacionado...">
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos" },
            { value: "PROCESSED", label: "Processados" },
            { value: "ERROR", label: "Erros" },
            { value: "RECEIVED", label: "Recebidos" },
          ]}
        />
      </FilterBar>
      <DataTable columns={columns} rows={rows} loading={isLoading} error={isError} onRetry={refetch} pageSize={10} onRowClick={(w) => setSelectedId(w.id)} />

      {selectedId && <WebhookDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function WebhookDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "webhook", id],
    queryFn: () => WebhooksAdminApi.get(id),
  });
  const webhook = data?.data;

  const reprocess = useMutation({
    mutationFn: () => WebhooksAdminApi.reprocess(id),
    onSuccess: () => {
      toast.success("Webhook reprocessado");
      queryClient.invalidateQueries({ queryKey: ["admin", "payments", "webhook", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payments", "webhooks"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao reprocessar"),
  });

  return (
    <Drawer open onClose={onClose} title={webhook ? "Webhook" : "Carregando..."}>
      {isLoading || !webhook ? (
        <DrawerSkeleton />
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <DetailRow label="ID" value={<code className="text-xs">{webhook.id}</code>} />
            <DetailRow label="Status" value={<StatusBadge tone={STATUS[webhook.status]?.tone ?? "neutral"}>{STATUS[webhook.status]?.label ?? webhook.status}</StatusBadge>} />
            <DetailRow label="Provedor" value={webhook.provider} />
            <DetailRow label="Evento" value={<code className="text-xs">{webhook.eventType}</code>} />
            <DetailRow label="Relacionado" value={`${webhook.relatedType} ${webhook.relatedId}`} />
            <DetailRow label="ID do evento (provedor)" value={<code className="text-xs">{webhook.providerEventId ?? "—"}</code>} />
            <DetailRow label="Assinatura válida" value={webhook.signatureValid ? "Sim" : "Não"} />
            <DetailRow label="Recebido em" value={formatDate(webhook.receivedAt)} />
            <DetailRow label="Processado em" value={formatDate(webhook.processedAt)} />
            {webhook.reprocessCount > 0 && (
              <DetailRow label="Reprocessamentos" value={`${webhook.reprocessCount} (última: ${formatDate(webhook.reprocessedAt)})`} />
            )}
            {webhook.errorMessage && <DetailRow label="Erro" value={webhook.errorMessage} />}
          </div>

          <JsonViewer label="Payload" data={webhook.payload} />

          {webhook.responseBody && <JsonViewer label="Resposta" data={webhook.responseBody} />}

          <Button variant="secondary" size="sm" loading={reprocess.isPending} onClick={() => reprocess.mutate()}>
            <RotateCw className="size-4" /> Reprocessar
          </Button>
        </div>
      )}
    </Drawer>
  );
}
