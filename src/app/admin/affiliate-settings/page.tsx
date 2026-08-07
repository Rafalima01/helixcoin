"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SettingsGroup, SettingsRow, DrawerSkeleton } from "@/components/admin/ui";
import { AffiliateSettingsAdminApi, ApiError } from "@/lib/admin/affiliate-api";
import type { AffiliateSettingsDto } from "@/modules/affiliate/dto/affiliate.dto";

export default function AdminAffiliateSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "affiliate", "settings"],
    queryFn: () => AffiliateSettingsAdminApi.get(),
  });
  const settings = data?.data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Configurações de Afiliados"
        description="CPA, comissão padrão e regras de aprovação — aplicados pelo Backend em cada depósito confirmado. A comissão de um afiliado vinculado a um Gerente é definida individualmente por ele (ou pelo Admin); a comissão padrão abaixo só vale para afiliados sem gerente (fluxo orgânico da plataforma)."
      />

      {isLoading || !settings ? (
        <DrawerSkeleton />
      ) : (
        // key={settings.updatedAt} remounts the form after a successful save, so its local
        // state always starts fresh from the latest server values without a sync effect.
        <SettingsForm key={settings.updatedAt} settings={settings} />
      )}
    </div>
  );
}

function SettingsForm({ settings }: { settings: AffiliateSettingsDto }) {
  const queryClient = useQueryClient();
  const [cpa, setCpa] = useState(String(settings.cpaAmountCents / 100));
  const [defaultCommission, setDefaultCommission] = useState(String(Math.round(settings.revShareLevel1Percent * 1000) / 10));
  const [autoApprove, setAutoApprove] = useState(settings.autoApproveCommissions);
  const [requireManagerApproval, setRequireManagerApproval] = useState(settings.requireManagerApprovalForAffiliates);

  const save = useMutation({
    mutationFn: () =>
      AffiliateSettingsAdminApi.update({
        cpaAmountCents: Math.round(Number(cpa) * 100),
        revShareLevel1Percent: Number(defaultCommission) / 100,
        autoApproveCommissions: autoApprove,
        requireManagerApprovalForAffiliates: requireManagerApproval,
      }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      queryClient.invalidateQueries({ queryKey: ["admin", "affiliate", "settings"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao salvar"),
  });

  return (
    <>
      <SettingsGroup title="Comissões e aprovação">
        <SettingsRow
          label="CPA"
          description="Bônus fixo pago apenas no primeiro depósito do jogador indicado (nível 1). Zero desativa."
        >
          <Input aria-label="Valor CPA (R$)" type="number" step="0.01" min="0" value={cpa} onChange={(e) => setCpa(e.target.value)} className="w-36" />
        </SettingsRow>

        <SettingsRow
          label="Comissão padrão da plataforma"
          description="Aplicada a afiliados aprovados sem gerente (fluxo orgânico) que não tenham uma comissão individual definida pelo Admin."
        >
          <Input
            aria-label="Comissão padrão (%)"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={defaultCommission}
            onChange={(e) => setDefaultCommission(e.target.value)}
            className="w-36"
          />
        </SettingsRow>

        <SettingsRow
          label="Aprovação de comissões"
          description="Se ativado, comissões ficam disponíveis (MAIN) imediatamente após serem geradas. Se desativado, ficam bloqueadas até aprovação manual do Admin."
        >
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="size-4 accent-purple" />
            Automática
          </label>
        </SettingsRow>

        <SettingsRow
          label="Aprovação de afiliados"
          description="Se ativado, o Gerente responsável pode aprovar/recusar cadastros da própria rede. Caso contrário, apenas o Admin decide."
        >
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={requireManagerApproval}
              onChange={(e) => setRequireManagerApproval(e.target.checked)}
              className="size-4 accent-purple"
            />
            Gerentes podem aprovar
          </label>
        </SettingsRow>
      </SettingsGroup>

      <div className="mt-5">
        <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
          Salvar configurações
        </Button>
      </div>
    </>
  );
}
