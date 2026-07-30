"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, DataTable, StatusBadge, Meter, SectionCard, type TableColumn } from "@/components/admin/ui";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import type { PromotionDTO } from "@/lib/admin/types";
import { formatCurrency } from "@/lib/utils";
import { PromotionSettingsAdminApi, ApiError } from "@/lib/admin/promotions-api";
import type { PromotionSettingsDto } from "@/modules/promotions/dto/promotions.dto";

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

function DemoBonusCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "promotions", "settings"],
    queryFn: () => PromotionSettingsAdminApi.get(),
  });
  const settings = data?.data;

  if (isLoading || !settings) return <p className="text-sm text-text-muted">Carregando...</p>;
  // key={settings.updatedAt} remounts the form after a successful save — same trick as affiliate-settings/page.tsx.
  return <DemoBonusForm key={settings.updatedAt} settings={settings} />;
}

function DemoBonusForm({ settings }: { settings: PromotionSettingsDto }) {
  const queryClient = useQueryClient();
  const [percent, setPercent] = useState(String(Math.round(settings.firstDepositBonusPercent * 1000) / 10));

  const save = useMutation({
    mutationFn: () => PromotionSettingsAdminApi.update({ firstDepositBonusPercent: Number(percent) / 100 }),
    onSuccess: () => {
      toast.success("Configuração salva");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", "settings"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao salvar"),
  });

  return (
    <SectionCard
      title="Bônus de Cadastro via Demo"
      description="Quem cria conta vindo do Modo Demo (landing → Teste Grátis) recebe esse percentual creditado automaticamente no primeiro depósito confirmado. 0 desativa. Refletido no modal do Demo em tempo real — nunca hardcoded no código."
    >
      <div className="flex items-end gap-3">
        <Input
          label="Bônus no primeiro depósito (%)"
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          className="max-w-[220px]"
        />
        <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
          Salvar
        </Button>
      </div>
    </SectionCard>
  );
}

export default function AdminPromotionsPage() {
  const { data, loading } = useAdminData(AdminServices.promotions);

  const columns: TableColumn<PromotionDTO>[] = [
    {
      key: "name",
      header: "Campanha",
      render: (p) => <span className="font-semibold">{p.name}</span>,
    },
    {
      key: "kind",
      header: "Tipo",
      render: (p) => <StatusBadge tone="info">{KIND[p.kind]}</StatusBadge>,
    },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <StatusBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</StatusBadge>
      ),
    },
    {
      key: "period",
      header: "Período",
      render: (p) => (
        <span className="text-xs text-text-secondary tabular-nums">
          {p.startsAt} → {p.endsAt}
        </span>
      ),
    },
    {
      key: "budget",
      header: "Orçamento utilizado",
      render: (p) => (
        <div className="min-w-[160px]">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-text-muted tabular-nums">{formatCurrency(p.used)}</span>
            <span className="text-text-secondary tabular-nums">{formatCurrency(p.budget)}</span>
          </div>
          <Meter
            value={(p.used / p.budget) * 100}
            tone={p.used / p.budget > 0.85 ? "warning" : "purple"}
          />
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
      <DemoBonusCard />
      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
