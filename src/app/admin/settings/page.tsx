"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionCard, StatusBadge } from "@/components/admin/ui";
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Marca e plataforma">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome da plataforma" value="HeliJump" readOnly />
            <Input label="Domínio principal" value="helijump.gg" readOnly />
            <Input label="Moeda" value="BRL (R$)" readOnly />
            <Input label="Fuso horário" value="America/Sao_Paulo" readOnly />
          </div>
        </SectionCard>

        <FinancialLimitsCard />

        <SectionCard
          title="Compliance & KYC"
          actions={<StatusBadge tone="success">Ativo</StatusBadge>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="KYC obrigatório a partir de" value="R$ 2.000,00 sacados" readOnly />
            <Input label="Idade mínima" value="18 anos" readOnly />
            <Input label="Países bloqueados" value="12 configurados" readOnly />
            <Input label="Limite de sessão diária" value="Desativado" readOnly />
          </div>
        </SectionCard>

        <SectionCard title="Aparência do app do jogador">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Tema" value="Dark (padrão)" readOnly />
            <Input label="Cor de destaque" value="#8B5CF6" readOnly />
            <Input label="Ticker de vitórias" value="Ativado" readOnly />
            <Input label="Jogadores online (widget)" value="Ativado" readOnly />
          </div>
        </SectionCard>
      </div>
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
      <SectionCard title="Limites financeiros">
        <Skeleton className="h-32 w-full rounded-2xl" />
      </SectionCard>
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
    <SectionCard
      title="Limites financeiros"
      actions={
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="size-4" /> Salvar
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Depósito mínimo (R$)"
          type="number"
          min={0}
          step="0.01"
          value={depositMin}
          onChange={(e) => setDepositMin(e.target.value)}
        />
        <Input
          label="Depósito máximo (R$)"
          type="number"
          min={0}
          step="0.01"
          value={depositMax}
          onChange={(e) => setDepositMax(e.target.value)}
        />
        <Input
          label="Saque mínimo (R$)"
          type="number"
          min={0}
          step="0.01"
          value={withdrawMin}
          onChange={(e) => setWithdrawMin(e.target.value)}
        />
        <Input
          label="Saque máximo (R$)"
          type="number"
          min={0}
          step="0.01"
          value={withdrawMax}
          onChange={(e) => setWithdrawMax(e.target.value)}
          hint="Por saque — ainda não existe um teto agregado diário."
        />
      </div>
    </SectionCard>
  );
}
