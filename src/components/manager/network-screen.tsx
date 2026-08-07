"use client";

import { useState } from "react";
import { Network, Check, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, Drawer, DetailRow, StatusBadge, type TableColumn } from "@/components/admin/ui";
import { ListRowAvatar } from "@/components/backoffice/list-row";
import { formatCurrency } from "@/lib/utils";
import {
  useManagerNetwork,
  useManagerProfile,
  useUpdateNetworkAffiliateCommission,
  useUpdateNetworkAffiliateInvitePermission,
} from "@/hooks/use-manager";
import type { AffiliateProfileAdminDto } from "@/modules/affiliate/dto/affiliate.dto";
import type { AffiliateNetworkStatsDto } from "@/modules/manager/dto/manager.dto";

const STATUS_BADGE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  APPROVED: "success",
  PENDING: "warning",
  DOCUMENTS_REQUESTED: "warning",
  REJECTED: "danger",
  BLOCKED: "danger",
};

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

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
      <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm font-semibold tabular-nums ml-auto">
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
    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
      <input
        type="checkbox"
        checked={affiliate.canInviteAffiliates}
        onChange={toggle}
        disabled={update.isPending}
        className="size-4 accent-purple"
      />
      Pode convidar novos afiliados
    </label>
  );
}

/**
 * Full detail for a network row — the audit's "5 estatísticas... com
 * detalhe completo num drawer" (§1.2, §6 passo 10). Every number comes
 * from AffiliateNetworkStatsDto, already computed server-side. Deliberately
 * no commission-generated/house-profit figure here, ever: a Manager must
 * never infer the platform's own margin from this screen.
 */
function NetworkDrawer({
  affiliate,
  ceiling,
  onClose,
}: {
  affiliate: AffiliateNetworkStatsDto;
  ceiling: number;
  onClose: () => void;
}) {
  return (
    <Drawer open onClose={onClose} title={affiliate.userName}>
      <div className="flex flex-col gap-5">
        <div>
          <DetailRow label="Email" value={affiliate.userEmail} />
          <DetailRow
            label="Status"
            value={<StatusBadge tone={STATUS_BADGE_TONE[affiliate.status] ?? "neutral"}>{STATUS_LABEL[affiliate.status] ?? affiliate.status}</StatusBadge>}
          />
          <DetailRow label="Desde" value={formatDate(affiliate.requestedAt)} />
        </div>

        {affiliate.status === "APPROVED" && (
          <>
            <div>
              <DetailRow label="Comissão" value={<CommissionEditor affiliate={affiliate} ceiling={ceiling} />} />
              <DetailRow label="Jogadores cadastrados" value={String(affiliate.playersReferredCount)} />
              <DetailRow label="FTDs" value={String(affiliate.ftdCount)} />
              <DetailRow label="Total de depósitos gerados" value={formatCurrency(affiliate.depositTotalCents / 100)} />
              <DetailRow label="Pago ao afiliado" value={formatCurrency(affiliate.paidToAffiliateCents / 100)} />
              <DetailRow
                label="Recebido por você"
                value={<span className="text-green font-bold">{formatCurrency(affiliate.keptByManagerCents / 100)}</span>}
              />
            </div>
            <InvitePermissionToggle affiliate={affiliate} />
          </>
        )}
      </div>
    </Drawer>
  );
}

export function ManagerNetworkScreen() {
  const { data, isLoading, isError, refetch } = useManagerNetwork();
  const { data: profile } = useManagerProfile();
  const ceiling = profile?.commissionPercent ?? 100;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data?.find((a) => a.id === selectedId);

  const columns: TableColumn<AffiliateNetworkStatsDto>[] = [
    {
      key: "affiliate",
      header: "Afiliado",
      render: (a) => (
        <div className="flex items-center gap-3 min-w-0">
          <ListRowAvatar tone="purple-gradient" size="sm">
            {a.userName.charAt(0).toUpperCase()}
          </ListRowAvatar>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{a.userName}</p>
            <p className="text-xs text-text-muted truncate">{a.userEmail}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <Badge variant={STATUS_BADGE[a.status] ?? "neutral"} size="sm">{STATUS_LABEL[a.status] ?? a.status}</Badge>,
    },
    {
      key: "commission",
      header: "Comissão",
      align: "right",
      render: (a) =>
        a.status === "APPROVED" ? (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <CommissionEditor affiliate={a} ceiling={ceiling} />
          </div>
        ) : (
          <span className="text-sm text-text-muted">—</span>
        ),
    },
    {
      key: "players",
      header: "Jogadores",
      align: "right",
      render: (a) => <span className="tabular-nums text-sm">{a.status === "APPROVED" ? a.playersReferredCount : "—"}</span>,
    },
    {
      key: "kept",
      header: "Recebido por você",
      align: "right",
      render: (a) => (
        <span className="tabular-nums text-sm font-semibold text-green">
          {a.status === "APPROVED" ? formatCurrency(a.keptByManagerCents / 100) : "—"}
        </span>
      ),
    },
    {
      key: "since",
      header: "Desde",
      align: "right",
      render: (a) => <span className="text-xs text-text-muted tabular-nums">{formatDate(a.requestedAt)}</span>,
    },
  ];

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

      {!isLoading && (!data || data.length === 0) ? (
        <Card className="p-10 flex flex-col items-center gap-3 text-center">
          <Network className="size-8 text-text-muted" />
          <p className="font-semibold">Nenhum afiliado ainda</p>
          <p className="text-sm text-text-secondary max-w-sm">
            Compartilhe seu link de convite para começar a formar sua rede de afiliados.
          </p>
        </Card>
      ) : (
        <DataTable columns={columns} rows={data ?? []} loading={isLoading} error={isError} onRetry={refetch} pageSize={10} onRowClick={(a) => setSelectedId(a.id)} />
      )}

      {selected && <NetworkDrawer affiliate={selected} ceiling={ceiling} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
