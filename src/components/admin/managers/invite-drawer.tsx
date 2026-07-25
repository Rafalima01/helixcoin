"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DetailRow, StatusBadge } from "@/components/admin/ui";
import { ManagerInvitesAdminApi, ApiError } from "@/lib/admin/affiliate-api";

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

const STATUS_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  ACTIVE: { label: "Convite enviado", tone: "info" },
  EXPIRED: { label: "Expirado", tone: "neutral" },
  REVOKED: { label: "Revogado", tone: "danger" },
  USED: { label: "Utilizado", tone: "success" },
};

const APPROVAL_STATUS_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDING_REVIEW: { label: "Aguardando aprovação", tone: "warning" },
  APPROVED: { label: "Aprovado", tone: "success" },
  REJECTED: { label: "Reprovado", tone: "danger" },
};

export function InviteDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "manager", "invite-detail", id],
    queryFn: () => ManagerInvitesAdminApi.get(id),
  });
  const invite = data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "manager", "invite-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "manager", "invites", "list"] });
  };

  const regenerate = useMutation({
    mutationFn: () => ManagerInvitesAdminApi.regenerate(id),
    onSuccess: (res) => {
      setFreshLink(res.data.inviteLink);
      toast.success("Novo link gerado — o anterior foi invalidado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao regenerar"),
  });

  const revoke = useMutation({
    mutationFn: () => ManagerInvitesAdminApi.revoke(id),
    onSuccess: () => {
      toast.success("Convite revogado");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao revogar"),
  });

  const copy = async () => {
    if (!freshLink) return;
    await navigator.clipboard.writeText(freshLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Drawer open onClose={onClose} title={invite ? "Convite de Gerente" : "Carregando..."}>
      {isLoading || !invite ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            {invite.name ? (
              <>
                <DetailRow label="Nome" value={invite.name} />
                <DetailRow label="Email" value={invite.email} />
                <DetailRow label="Telefone" value={invite.phone ?? "—"} />
              </>
            ) : (
              <DetailRow label="Candidato" value="Aguardando cadastro — o link ainda não foi utilizado" />
            )}
            <DetailRow label="Status do convite" value={<StatusBadge tone={STATUS_LABEL[invite.status]?.tone ?? "neutral"}>{STATUS_LABEL[invite.status]?.label ?? invite.status}</StatusBadge>} />
            {invite.approvalStatus && (
              <DetailRow
                label="Status da solicitação"
                value={
                  <StatusBadge tone={APPROVAL_STATUS_LABEL[invite.approvalStatus]?.tone ?? "neutral"}>
                    {APPROVAL_STATUS_LABEL[invite.approvalStatus]?.label ?? invite.approvalStatus}
                  </StatusBadge>
                }
              />
            )}
            {invite.approvedCommissionPercent !== null && (
              <DetailRow label="Comissão máxima aprovada" value={`${invite.approvedCommissionPercent}%`} />
            )}
            <DetailRow label="Enviado por" value={invite.createdByName} />
            <DetailRow label="Criado em" value={formatDate(invite.createdAt)} />
            <DetailRow label="Expira em" value={formatDate(invite.expiresAt)} />
            {invite.notes && <DetailRow label="Observações" value={invite.notes} />}
            {invite.acceptedIp && <DetailRow label="IP no aceite" value={invite.acceptedIp} />}
            {invite.acceptedUserAgent && <DetailRow label="Navegador no aceite" value={invite.acceptedUserAgent} />}
            {invite.revokedByName && <DetailRow label="Revogado por" value={invite.revokedByName} />}
            {invite.rejectionReason && <DetailRow label="Motivo da reprovação" value={invite.rejectionReason} />}
          </div>

          {freshLink && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-black/30 px-4 py-3">
              <p className="text-sm text-text-secondary truncate">{freshLink}</p>
              <button onClick={copy} aria-label="Copiar link">
                {copied ? <Check className="size-4 text-green shrink-0" /> : <Copy className="size-4 text-text-muted shrink-0" />}
              </button>
            </div>
          )}

          {invite.status !== "USED" && invite.status !== "REVOKED" && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" loading={regenerate.isPending} onClick={() => regenerate.mutate()} className="flex-1">
                Regenerar link
              </Button>
              <Button variant="danger" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate()} className="flex-1">
                Revogar
              </Button>
            </div>
          )}

          <p className="text-[11px] text-text-muted">
            Por segurança, o link só é exibido no momento em que é criado ou regenerado — não fica salvo em texto puro.
          </p>
        </div>
      )}
    </Drawer>
  );
}
