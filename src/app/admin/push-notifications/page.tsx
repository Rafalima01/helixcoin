"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, DataTable, StatusBadge, Drawer, DetailRow, FilterChips, type TableColumn } from "@/components/admin/ui";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { NotificationPreferencesApi, ApiError } from "@/lib/notifications-api";
import { NotificationsAdminApi, type PushNotificationLogDto } from "@/lib/admin/notifications-api";

const CATEGORY_LABEL: Record<string, string> = {
  DEPOSIT_CONFIRMED: "Novo depósito confirmado",
  WITHDRAW_REQUESTED: "Nova solicitação de saque",
  WITHDRAW_APPROVED: "Saque aprovado",
  WITHDRAW_REJECTED: "Saque recusado",
  MANAGER_REQUESTED: "Nova solicitação de gerente",
  AFFILIATE_REQUESTED: "Novo afiliado",
  DAILY_SUMMARY: "Relatório diário",
  SYSTEM_CRITICAL_ALERT: "Alertas críticos do sistema",
  TEST: "Notificação de teste",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  QUEUED: "neutral",
  SENT: "info",
  DELIVERED: "success",
  FAILED: "danger",
  CLICKED: "success",
};

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

export default function AdminPushNotificationsPage() {
  const { state, enable } = usePushNotifications();
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "notifications", "history", status],
    queryFn: () => NotificationsAdminApi.list({ status: status === "all" ? undefined : status, page: 1, pageSize: 100 }),
  });
  const rows = data?.data ?? [];

  const sendTest = useMutation({
    mutationFn: () => NotificationsAdminApi.sendTest(),
    onSuccess: () => {
      toast.success("Notificação de teste enviada — confira o histórico abaixo");
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "history"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao enviar notificação de teste"),
  });

  const columns: TableColumn<PushNotificationLogDto>[] = [
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusBadge tone={STATUS_TONE[l.status] ?? "neutral"}>{l.status}</StatusBadge>,
    },
    {
      key: "category",
      header: "Categoria",
      render: (l) => <span className="text-text-secondary">{CATEGORY_LABEL[l.category] ?? l.category}</span>,
    },
    { key: "title", header: "Título", render: (l) => <span className="font-semibold">{l.title}</span> },
    { key: "body", header: "Mensagem", render: (l) => <span className="text-xs text-text-muted line-clamp-2">{l.body}</span> },
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
        title="Push Notifications"
        description="Notificações reais enviadas ao navegador/celular do Admin — depósitos, saques, solicitações e o resumo diário. Diferente de “Notificações” (campanhas de marketing, ainda mockup)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" loading={sendTest.isPending} onClick={() => sendTest.mutate()}>
              🔔 Enviar Notificação de Teste
            </Button>
            <Button variant="primary" size="sm" loading={state === "subscribing"} onClick={() => void enable()}>
              {state === "subscribed" ? <BellRing className="size-4" /> : <Bell className="size-4" />}
              {state === "subscribed" ? "Notificações ativas" : "Ativar notificações neste dispositivo"}
            </Button>
          </div>
        }
      />

      {state === "denied" && (
        <Card className="p-4 text-sm text-warning">
          Permissão de notificações negada pelo navegador. Ative nas configurações do site para receber pushes.
        </Card>
      )}
      {state === "unsupported" && (
        <Card className="p-4 text-sm text-text-muted">Este navegador não suporta Web Push.</Card>
      )}

      <PreferencesPanel />

      <FilterChips
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "Todos" },
          { value: "SENT", label: "Enviados" },
          { value: "DELIVERED", label: "Entregues" },
          { value: "CLICKED", label: "Clicados" },
          { value: "FAILED", label: "Falharam" },
        ]}
      />
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15} onRowClick={(l) => setSelectedId(l.id)} />

      {selectedId && <HistoryDrawer log={rows.find((l) => l.id === selectedId) ?? null} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function PreferencesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => NotificationPreferencesApi.list(),
  });

  if (isLoading || !data) return <Skeleton className="h-40 w-full rounded-2xl" />;
  return <PreferencesForm key={data.data.map((p) => `${p.category}:${p.enabled}`).join(",")} preferences={data.data} />;
}

function PreferencesForm({ preferences }: { preferences: { category: string; enabled: boolean }[] }) {
  const queryClient = useQueryClient();
  const [local, setLocal] = useState(preferences);

  const update = useMutation({
    mutationFn: ({ category, enabled }: { category: string; enabled: boolean }) => NotificationPreferencesApi.update(category, enabled),
    onSuccess: () => {
      toast.success("Preferência atualizada");
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao atualizar preferência"),
  });

  return (
    <Card className="p-5">
      <p className="mb-3 font-bold">Categorias de notificação</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {local.map((pref) => (
          <label key={pref.category} className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={pref.enabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setLocal((rows) => rows.map((r) => (r.category === pref.category ? { ...r, enabled } : r)));
                update.mutate({ category: pref.category, enabled });
              }}
            />
            {CATEGORY_LABEL[pref.category] ?? pref.category}
          </label>
        ))}
      </div>
    </Card>
  );
}

function HistoryDrawer({ log, onClose }: { log: PushNotificationLogDto | null; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} title="Push Notification">
      {!log ? (
        <p className="text-sm text-text-muted">Registro não encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <DetailRow label="ID" value={<code className="text-xs">{log.id}</code>} />
          <DetailRow label="Status" value={<StatusBadge tone={STATUS_TONE[log.status] ?? "neutral"}>{log.status}</StatusBadge>} />
          <DetailRow label="Categoria" value={CATEGORY_LABEL[log.category] ?? log.category} />
          <DetailRow label="Título" value={log.title} />
          <DetailRow label="Mensagem" value={<span className="whitespace-pre-line">{log.body}</span>} />
          {log.deepLink && <DetailRow label="Deep link" value={<code className="text-xs break-all">{log.deepLink}</code>} />}
          <DetailRow label="Criado em" value={formatDate(log.createdAt)} />
          <DetailRow label="Enviado em" value={formatDate(log.sentAt)} />
          <DetailRow label="Entregue em" value={formatDate(log.deliveredAt)} />
          <DetailRow label="Clicado em" value={formatDate(log.clickedAt)} />
          {log.errorMessage && <DetailRow label="Erro" value={log.errorMessage} />}
        </div>
      )}
    </Drawer>
  );
}
