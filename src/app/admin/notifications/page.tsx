"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, StatusBadge, SectionCard, type TableColumn } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { NotificationCampaignDTO } from "@/lib/admin/types";

const CHANNEL: Record<NotificationCampaignDTO["channel"], string> = {
  push: "Push",
  email: "E-mail",
  "in-app": "In-app",
  sms: "SMS",
};

export default function AdminNotificationsPage() {
  const { data, loading } = useAdminData(AdminServices.notifications);

  const columns: TableColumn<NotificationCampaignDTO>[] = [
    { key: "title", header: "Campanha", render: (n) => <span className="font-semibold">{n.title}</span> },
    { key: "channel", header: "Canal", render: (n) => <StatusBadge tone="info">{CHANNEL[n.channel]}</StatusBadge> },
    { key: "audience", header: "Audiência", render: (n) => <span className="text-xs text-text-secondary">{n.audience}</span> },
    {
      key: "status",
      header: "Status",
      render: (n) => (
        <StatusBadge tone={n.status === "sent" ? "success" : n.status === "scheduled" ? "info" : "neutral"}>
          {n.status === "sent" ? "Enviada" : n.status === "scheduled" ? "Agendada" : "Rascunho"}
        </StatusBadge>
      ),
    },
    { key: "sentAt", header: "Envio", align: "right", render: (n) => <span className="text-xs text-text-muted tabular-nums">{n.sentAt}</span> },
    { key: "open", header: "Abertura", align: "right", render: (n) => <span className="font-semibold tabular-nums">{n.openRate > 0 ? `${n.openRate}%` : "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notificações"
        description="Campanhas por push, e-mail, in-app e SMS. Segmentação e disparo serão executados em filas no Backend."
      />

      <SectionCard title="Novo disparo rápido" description="Compositor (mock — envio na próxima fase)">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input label="Título" placeholder="Ex.: Cashback liberado 🎁" />
          <Input label="Audiência" placeholder="Ex.: Jogadores ativos (7d)" />
          <div className="flex items-end">
            <Button variant="primary" size="md" onClick={notImplemented}>
              <Send className="size-4" /> Enviar
            </Button>
          </div>
        </div>
      </SectionCard>

      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
