"use client";

import { useState } from "react";
import { Sparkles, Timer, Flame } from "lucide-react";
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
import { PaymentSettingsAdminApi } from "@/lib/admin/payments-api";
import type { PromotionSettingsDto } from "@/modules/promotions/dto/promotions.dto";
import { DepositQuickAmountEditor } from "@/components/admin/promotions/deposit-quick-amount-editor";

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

function PromotionSettingsCards() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "promotions", "settings"],
    queryFn: () => PromotionSettingsAdminApi.get(),
  });
  const settings = data?.data;

  if (isLoading || !settings) return <p className="text-sm text-text-muted">Carregando...</p>;
  // key={settings.updatedAt} remounts every card after a successful save — same trick as affiliate-settings/page.tsx.
  return (
    <div className="flex flex-col gap-5" key={settings.updatedAt}>
      <DemoBonusForm settings={settings} />
      <SecondDepositBonusForm settings={settings} />
      <DepositCountdownForm settings={settings} />
      <DepositQuickAmountsForm settings={settings} />
    </div>
  );
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

function SecondDepositBonusForm({ settings }: { settings: PromotionSettingsDto }) {
  const queryClient = useQueryClient();
  const [percent, setPercent] = useState(String(Math.round(settings.secondDepositBonusPercent * 1000) / 10));

  const save = useMutation({
    mutationFn: () => PromotionSettingsAdminApi.update({ secondDepositBonusPercent: Number(percent) / 100 }),
    onSuccess: () => {
      toast.success("Configuração salva");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", "settings"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao salvar"),
  });

  return (
    <SectionCard
      title="Bônus de Segundo Depósito"
      description='Percentual exibido na tela de Depósito ("Garanta X% de bônus a partir do segundo depósito"). 0 oculta a chamada. Este bônus ainda não é creditado automaticamente — só o texto é dinâmico.'
    >
      <div className="flex items-end gap-3">
        <Input
          label="Bônus no segundo depósito (%)"
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

function DepositCountdownForm({ settings }: { settings: PromotionSettingsDto }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(settings.depositPromoEnabled);
  const [minutes, setMinutes] = useState(String(Math.round(settings.depositPromoDurationSeconds / 60)));

  const save = useMutation({
    mutationFn: () =>
      PromotionSettingsAdminApi.update({
        depositPromoEnabled: enabled,
        depositPromoDurationSeconds: Math.max(30, Math.round(Number(minutes) * 60)),
      }),
    onSuccess: () => {
      toast.success("Configuração salva");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", "settings"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao salvar"),
  });

  return (
    <SectionCard
      title="Contagem Regressiva do Depósito"
      description='Banner de oferta ("Bônus expira em") na tela de Depósito. Duração nunca fixa no código — sempre lida daqui.'
      actions={
        <Timer className="size-4 text-text-muted" />
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 accent-purple"
          />
          Ativar contagem regressiva
        </label>
        <Input
          label="Duração (minutos)"
          type="number"
          step="1"
          min="1"
          max="60"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="max-w-[160px]"
          disabled={!enabled}
        />
        <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
          Salvar
        </Button>
      </div>
    </SectionCard>
  );
}

function DepositQuickAmountsForm({ settings }: { settings: PromotionSettingsDto }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState(settings.depositQuickAmounts);
  const { data: paymentSettings } = useQuery({
    queryKey: ["admin", "payments", "settings"],
    queryFn: () => PaymentSettingsAdminApi.get(),
  });
  const limits = paymentSettings?.data;

  const save = useMutation({
    mutationFn: () => PromotionSettingsAdminApi.update({ depositQuickAmounts: items }),
    onSuccess: () => {
      toast.success("Configuração salva");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions", "settings"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao salvar"),
  });

  return (
    <SectionCard
      title="Valores Rápidos de Depósito"
      description={
        limits
          ? `Botões exibidos na tela de Depósito — adicionar, editar, remover, reordenar e destacar. Devem respeitar os limites atuais: ${formatCurrency(limits.depositMinCents / 100)} a ${formatCurrency(limits.depositMaxCents / 100)}.`
          : "Botões exibidos na tela de Depósito — adicionar, editar, remover, reordenar e destacar."
      }
      actions={<Flame className="size-4 text-gold" />}
    >
      <DepositQuickAmountEditor items={items} onChange={setItems} />
      <Button variant="primary" className="mt-4" loading={save.isPending} onClick={() => save.mutate()}>
        Salvar valores
      </Button>
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
      <PromotionSettingsCards />
      <DataTable columns={columns} rows={data ?? []} loading={loading} />
    </div>
  );
}
