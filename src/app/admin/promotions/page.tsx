"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable, StatusBadge, Meter, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { PromotionDTO } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/utils";

const KIND: Record<PromotionDTO["kind"], string> = {
  bonus: "Bônus",
  cashback: "Cashback",
  mission: "Missões",
  season: "Temporada",
  tournament: "Torneio",
};

const STATUS = {
  active: { label: "Ativa", tone: "success" as const },
  scheduled: { label: "Agendada", tone: "info" as const },
  ended: { label: "Encerrada", tone: "neutral" as const },
  draft: { label: "Rascunho", tone: "warning" as const },
};

export default function AdminPromotionsPage() {
  const { data, loading } = useAdminData(AdminServices.promotions);

  const columns: TableColumn<PromotionDTO>[] = [
    { key: "name", header: "Campanha", render: (p) => <span className="font-semibold">{p.name}</span> },
    { key: "kind", header: "Tipo", render: (p) => <StatusBadge tone="info">{KIND[p.kind]}</StatusBadge> },
    { key: "status", header: "Status", render: (p) => <StatusBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</StatusBadge> },
    { key: "period", header: "Período", render: (p) => <span className="text-xs text-text-secondary tabular-nums">{p.startsAt} → {p.endsAt}</span> },
    {
      key: "budget",
      header: "Orçamento utilizado",
      render: (p) => (
        <div className="min-w-[160px]">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-text-muted tabular-nums">{formatCurrency(p.used)}</span>
            <span className="text-text-secondary tabular-nums">{formatCurrency(p.budget)}</span>
          </div>
          <Meter value={(p.used / p.budget) * 100} tone={p.used / p.budget > 0.85 ? "warning" : "purple"} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Promoções"
        description="Bônus, cashback, missões, temporadas e torneios. Motores de elegibilidade e crédito rodarão no Backend."
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <Sparkles className="size-4" /> Nova campanha
          </Button>
        }
      />
      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
