"use client";

import { Plug, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";

const STATUS = {
  connected: { label: "Conectada", tone: "success" as const },
  disconnected: { label: "Desconectada", tone: "neutral" as const },
  error: { label: "Erro", tone: "danger" as const },
};

export default function AdminIntegrationsPage() {
  const { data, loading } = useAdminData(AdminServices.integrations);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Integrações"
        description="Serviços externos conectados à plataforma. Credenciais ficarão em vault seguro no Backend."
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <Plug className="size-4" /> Nova integração
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading || !data
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)
          : data.map((it) => (
              <Card key={it.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{it.name}</p>
                    <p className="text-xs text-text-muted">{it.category}</p>
                  </div>
                  <StatusBadge tone={STATUS[it.status].tone} pulse={it.status === "connected"}>
                    {STATUS[it.status].label}
                  </StatusBadge>
                </div>
                <p className="text-xs text-text-secondary">Última sincronização: {it.lastSyncAt}</p>
                <Button variant="secondary" size="sm" onClick={notImplemented} className="self-start">
                  <Settings2 className="size-3.5" /> Configurar
                </Button>
              </Card>
            ))}
      </div>
    </div>
  );
}
