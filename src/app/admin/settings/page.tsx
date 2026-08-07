"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SettingsGroup, SettingsRow } from "@/components/admin/ui";
import { PaymentSettingsAdminApi, ApiError } from "@/lib/admin/payments-api";
import type { PaymentSettingsDto } from "@/modules/payments/dto/payments.dto";

/** Marca/Compliance/Aparência ainda são maquete (Fase 1) — só Limites financeiros é real, ligado ao mesmo PaymentSettings que o painel de Roteamento (em Gateways) já usa. */
export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Configurações"
        description="Parâmetros globais da plataforma. Nenhuma configuração crítica vive no Frontend — tudo será persistido e validado pelo Backend."
      />

      <FinancialLimitsCard />

      <SettingsGroup title="Marca e plataforma" description="Ainda não editável — mostrados como referência." mock>
        <SettingsRow label="Nome da plataforma"><Input aria-label="Nome da plataforma" value="HeliJump" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Domínio principal"><Input aria-label="Domínio principal" value="helijump.gg" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Moeda"><Input aria-label="Moeda" value="BRL (R$)" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Fuso horário"><Input aria-label="Fuso horário" value="America/Sao_Paulo" readOnly className="w-48" /></SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Compliance & KYC" description="Ainda não editável — mostrados como referência." mock>
        <SettingsRow label="KYC obrigatório a partir de"><Input aria-label="KYC obrigatório a partir de" value="R$ 2.000,00 sacados" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Idade mínima"><Input aria-label="Idade mínima" value="18 anos" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Países bloqueados"><Input aria-label="Países bloqueados" value="12 configurados" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Limite de sessão diária"><Input aria-label="Limite de sessão diária" value="Desativado" readOnly className="w-48" /></SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Aparência do app do jogador" description="Ainda não editável — mostrados como referência." mock>
        <SettingsRow label="Tema"><Input aria-label="Tema" value="Dark (padrão)" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Cor de destaque"><Input aria-label="Cor de destaque" value="#8B5CF6" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Ticker de vitórias"><Input aria-label="Ticker de vitórias" value="Ativado" readOnly className="w-48" /></SettingsRow>
        <SettingsRow label="Jogadores online (widget)"><Input aria-label="Jogadores online (widget)" value="Ativado" readOnly className="w-48" /></SettingsRow>
      </SettingsGroup>
    </div>
  );
}

function FinancialLimitsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "settings"],
    queryFn: () => PaymentSettingsAdminApi.get(),
  });
  const settings = data?.data;

  if (isLoading || !settings) {
    return (
      <SettingsGroup title="Limites financeiros">
        <div className="p-5">
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </SettingsGroup>
    );
  }
  // Remounts (via key) after a successful save instead of syncing local state from the query in an effect.
  return <FinancialLimitsForm key={settings.updatedAt} settings={settings} />;
}

const centsToReaisStr = (cents: number) => (cents / 100).toFixed(2);
const reaisStrToCents = (value: string) => Math.round(Number(value) * 100);

function FinancialLimitsForm({ settings }: { settings: PaymentSettingsDto }) {
  const queryClient = useQueryClient();
  const [depositMin, setDepositMin] = useState(centsToReaisStr(settings.depositMinCents));
  const [depositMax, setDepositMax] = useState(centsToReaisStr(settings.depositMaxCents));
  const [withdrawMin, setWithdrawMin] = useState(centsToReaisStr(settings.withdrawMinCents));
  const [withdrawMax, setWithdrawMax] = useState(centsToReaisStr(settings.withdrawMaxCents));

  const save = useMutation({
    mutationFn: () =>
      PaymentSettingsAdminApi.update({
        depositMinCents: reaisStrToCents(depositMin),
        depositMaxCents: reaisStrToCents(depositMax),
        withdrawMinCents: reaisStrToCents(withdrawMin),
        withdrawMaxCents: reaisStrToCents(withdrawMax),
      }),
    onSuccess: () => {
      toast.success("Limites financeiros atualizados");
      queryClient.invalidateQueries({ queryKey: ["admin", "payments", "settings"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao salvar limites"),
  });

  return (
    <SettingsGroup
      title="Limites financeiros"
      actions={
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="size-4" /> Salvar
        </Button>
      }
    >
      <SettingsRow label="Depósito mínimo (R$)">
        <Input
          aria-label="Depósito mínimo (R$)"
          type="number"
          min={0}
          step="0.01"
          value={depositMin}
          onChange={(e) => setDepositMin(e.target.value)}
          className="w-36"
        />
      </SettingsRow>
      <SettingsRow label="Depósito máximo (R$)">
        <Input
          aria-label="Depósito máximo (R$)"
          type="number"
          min={0}
          step="0.01"
          value={depositMax}
          onChange={(e) => setDepositMax(e.target.value)}
          className="w-36"
        />
      </SettingsRow>
      <SettingsRow label="Saque mínimo (R$)">
        <Input
          aria-label="Saque mínimo (R$)"
          type="number"
          min={0}
          step="0.01"
          value={withdrawMin}
          onChange={(e) => setWithdrawMin(e.target.value)}
          className="w-36"
        />
      </SettingsRow>
      <SettingsRow label="Saque máximo (R$)" description="Por saque — ainda não existe um teto agregado diário.">
        <Input
          aria-label="Saque máximo (R$)"
          type="number"
          min={0}
          step="0.01"
          value={withdrawMax}
          onChange={(e) => setWithdrawMax(e.target.value)}
          className="w-36"
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
