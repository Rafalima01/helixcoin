"use client";

import { Plug2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatusBadge, Meter, DetailRow } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import { formatCurrency } from "@/lib/utils";

const STATUS = {
  online: { label: "Online", tone: "success" as const },
  degraded: { label: "Degradado", tone: "warning" as const },
  offline: { label: "Offline", tone: "danger" as const },
};

export default function AdminGatewaysPage() {
  const { data, loading } = useAdminData(AdminServices.gateways);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gateway de Pagamentos"
        description="Saúde, volume e roteamento dos provedores PIX. Failover automático será configurado no Backend."
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <Plug2 className="size-4" /> Conectar gateway
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
        {loading || !data
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)
          : data.map((g) => (
              <Card key={g.id} className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{g.name}</p>
                    <p className="text-xs text-text-muted truncate">{g.provider}</p>
                  </div>
                  <StatusBadge tone={STATUS[g.status].tone} pulse={g.status !== "offline"}>
                    {STATUS[g.status].label}
                  </StatusBadge>
                </div>

                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-text-muted">Taxa de sucesso</span>
                    <span className="font-bold tabular-nums">{g.successRate.toFixed(1)}%</span>
                  </div>
                  <Meter value={g.successRate} tone={g.successRate > 97 ? "green" : g.successRate > 90 ? "warning" : "error"} />
                </div>

                <DetailRow label="Volume (24h)" value={formatCurrency(g.volume24h)} />
                <DetailRow label="Latência média" value={g.avgLatencyMs > 0 ? `${g.avgLatencyMs} ms` : "—"} />
                <DetailRow label="Tarifa" value={g.fee} />

                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={notImplemented} className="flex-1">
                    <Settings2 className="size-3.5" /> Configurar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={notImplemented} className="border border-border flex-1">
                    Ver transações
                  </Button>
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}
