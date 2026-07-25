"use client";

import { useState } from "react";
import { Network, Check, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useManagerNetwork,
  useManagerProfile,
  useUpdateNetworkAffiliateCommission,
  useUpdateNetworkAffiliateInvitePermission,
} from "@/hooks/use-manager";
import type { AffiliateProfileAdminDto } from "@/modules/affiliate/dto/affiliate.dto";

const STATUS_BADGE: Record<string, "green" | "warning" | "error" | "neutral"> = {
  APPROVED: "green",
  PENDING: "warning",
  DOCUMENTS_REQUESTED: "warning",
  REJECTED: "error",
  BLOCKED: "error",
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Aprovado",
  PENDING: "Pendente",
  DOCUMENTS_REQUESTED: "Documentos pendentes",
  REJECTED: "Recusado",
  BLOCKED: "Bloqueado",
};

function CommissionEditor({ affiliate, ceiling }: { affiliate: AffiliateProfileAdminDto; ceiling: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(affiliate.commissionPercent ?? ""));
  const update = useUpdateNetworkAffiliateCommission();

  const percent = Number(value);
  const isValidNumber = value.trim() !== "" && !Number.isNaN(percent);
  const overCeiling = isValidNumber && percent > ceiling;
  const canSave = isValidNumber && percent >= 0 && !overCeiling;

  const save = () => {
    if (!canSave) return;
    update.mutate(
      { affiliateId: affiliate.id, percent },
      {
        onSuccess: () => {
          toast.success("Comissão do afiliado atualizada");
          setEditing(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao atualizar comissão"),
      }
    );
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
        {affiliate.commissionPercent !== null ? `${affiliate.commissionPercent}%` : "Padrão"}
        <Pencil className="size-3 text-text-muted" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          max={ceiling}
          step="0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 h-9 text-sm"
        />
        <Button
          variant="primary"
          size="sm"
          className="!h-9 !w-9 !p-0"
          loading={update.isPending}
          disabled={!canSave}
          onClick={save}
        >
          <Check className="size-4" />
        </Button>
      </div>
      <p className={`text-[11px] whitespace-nowrap ${overCeiling ? "text-error" : "text-text-muted"}`}>
        {!isValidNumber
          ? `Teto: ${ceiling}%`
          : overCeiling
            ? `Não pode ultrapassar o teto do gerente (${ceiling}%).`
            : `Você ficará com: ${Math.max(0, ceiling - percent)}%`}
      </p>
    </div>
  );
}

function InvitePermissionToggle({ affiliate }: { affiliate: AffiliateProfileAdminDto }) {
  const update = useUpdateNetworkAffiliateInvitePermission();

  const toggle = () => {
    update.mutate(
      { affiliateId: affiliate.id, canInviteAffiliates: !affiliate.canInviteAffiliates },
      {
        onSuccess: () =>
          toast.success(
            !affiliate.canInviteAffiliates ? "Afiliado pode convidar novos afiliados" : "Permissão de convite removida"
          ),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao atualizar permissão"),
      }
    );
  };

  return (
    <label className="flex items-center gap-1.5 text-[11px] text-text-muted whitespace-nowrap cursor-pointer">
      <input
        type="checkbox"
        checked={affiliate.canInviteAffiliates}
        onChange={toggle}
        disabled={update.isPending}
        className="size-3.5 accent-purple"
      />
      Convidar afiliados
    </label>
  );
}

export function ManagerNetworkScreen() {
  const { data, isLoading } = useManagerNetwork();
  const { data: profile } = useManagerProfile();
  const ceiling = profile?.commissionPercent ?? 100;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Minha <span className="text-gradient-brand">Rede</span>
        </h1>
        <p className="text-text-secondary mt-2">
          Todos os afiliados vinculados a você. Defina a comissão de cada um — nunca acima do seu teto de {ceiling}%.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-3 text-center">
          <Network className="size-8 text-text-muted" />
          <p className="font-semibold">Nenhum afiliado ainda</p>
          <p className="text-sm text-text-secondary max-w-sm">
            Compartilhe seu link de convite para começar a formar sua rede de afiliados.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.map((aff) => (
            <Card key={aff.id} className="p-4 flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple/60 to-pink/60 text-white text-sm font-bold">
                {aff.userName.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{aff.userName}</p>
                  <Badge variant={STATUS_BADGE[aff.status] ?? "neutral"} size="sm">
                    {STATUS_LABEL[aff.status] ?? aff.status}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary truncate">{aff.userEmail}</p>
              </div>
              {aff.status === "APPROVED" && (
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <CommissionEditor affiliate={aff} ceiling={ceiling} />
                  <InvitePermissionToggle affiliate={aff} />
                </div>
              )}
              <p className="shrink-0 text-[11px] text-text-muted">
                Desde {new Date(aff.requestedAt).toLocaleDateString("pt-BR")}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
