"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DetailRow, StatusBadge } from "@/components/admin/ui";
import { ManagersAdminApi, ManagerInvitesAdminApi, ApiError } from "@/lib/admin/affiliate-api";

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

function copyToClipboard(value: string) {
  navigator.clipboard.writeText(value);
  toast.success("Link copiado!");
}

export function ManagerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [commissionInput, setCommissionInput] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "manager", "detail", id],
    queryFn: () => ManagersAdminApi.get(id),
  });
  const manager = data?.data;

  const { data: inviteData } = useQuery({
    queryKey: ["admin", "manager", "origin-invite", manager?.inviteId],
    queryFn: () => ManagerInvitesAdminApi.get(manager!.inviteId!),
    enabled: !!manager?.inviteId,
  });
  const originInvite = inviteData?.data;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "manager", "detail", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "manager", "list"] });
  };

  const activate = useMutation({
    mutationFn: () => ManagersAdminApi.activate(id),
    onSuccess: () => {
      toast.success("Acesso ao painel ativado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao ativar"),
  });

  const updateCommission = useMutation({
    mutationFn: (percent: number) => ManagersAdminApi.updateCommission(id, percent),
    onSuccess: () => {
      toast.success("Comissão atualizada");
      setCommissionInput(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao atualizar comissão"),
  });

  return (
    <Drawer open onClose={onClose} title={manager ? "Gerente" : "Carregando..."}>
      {isLoading || !manager ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <DetailRow label="ID" value={<code className="text-xs">{manager.id}</code>} />
            <DetailRow label="Nome" value={manager.userName} />
            <DetailRow label="Email" value={manager.userEmail} />
            <DetailRow label="Código de gerente" value={<code className="text-xs text-purple">{manager.inviteCode}</code>} />
            <DetailRow label="Status" value={<StatusBadge tone={manager.status === "ACTIVE" ? "success" : "warning"}>{manager.status === "ACTIVE" ? "Ativo" : "Pendente"}</StatusBadge>} />
            <DetailRow label="Afiliados na rede" value={String(manager.affiliateCount)} />
            <DetailRow label="Criado em" value={formatDate(manager.createdAt)} />
          </div>

          {manager.status === "PENDING" && (
            <Button variant="success" size="sm" loading={activate.isPending} onClick={() => activate.mutate()}>
              Ativar acesso ao painel
            </Button>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">Comissão máxima (%)</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={commissionInput ?? String(manager.commissionPercent)}
                onChange={(e) => setCommissionInput(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                loading={updateCommission.isPending}
                onClick={() => updateCommission.mutate(Number(commissionInput ?? manager.commissionPercent))}
              >
                Salvar
              </Button>
            </div>
            <p className="text-[11px] text-text-muted">Teto — afiliados da rede deste gerente nunca podem exceder este percentual.</p>
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Links</p>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-text-secondary">Link da Plataforma <span className="text-text-muted font-normal">({manager.platformLinkClicks} cliques)</span></p>
              <button
                onClick={() => copyToClipboard(`${origin}/r/${manager.userReferralCode}`)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-black/30 px-4 py-3 text-left"
              >
                <p className="text-xs text-text-secondary truncate">{`${origin}/r/${manager.userReferralCode}`}</p>
                <Copy className="size-4 text-text-muted shrink-0" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-text-secondary">Link de Convite de Afiliados <span className="text-text-muted font-normal">({manager.inviteLinkClicks} cliques)</span></p>
              <button
                onClick={() => copyToClipboard(`${origin}/affiliate-invite/${manager.inviteCode}`)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-black/30 px-4 py-3 text-left"
              >
                <p className="text-xs text-text-secondary truncate">{`${origin}/affiliate-invite/${manager.inviteCode}`}</p>
                <Copy className="size-4 text-text-muted shrink-0" />
              </button>
            </div>
          </div>

          {originInvite && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">Convite de origem</p>
              <DetailRow label="Convidado por" value={originInvite.createdByName} />
              <DetailRow label="Aceito em" value={formatDate(originInvite.acceptedAt)} />
              <DetailRow label="IP no aceite" value={originInvite.acceptedIp ?? "—"} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
