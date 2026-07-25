"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy, Check, RotateCw, Ban } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ManagerInvitesAdminApi, ApiError } from "@/lib/admin/affiliate-api";

/**
 * "Cadastro de Gerente" (correção): o Admin nunca cadastra o gerente
 * manualmente — só gera um link de convite em branco. Quem preenche
 * nome/e-mail/telefone/senha é o próprio candidato ao abrir o link (ver
 * InviteAcceptScreen); a solicitação resultante é aprovada em Solicitações,
 * onde a comissão máxima é decidida. Abrir o modal já dispara a criação —
 * não há formulário aqui.
 */
export function InviteManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [resultLink, setResultLink] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [copied, setCopied] = useState(false);

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["admin", "manager", "invites", "list"] });

  const create = useMutation({
    mutationFn: () => ManagerInvitesAdminApi.create({}),
    onSuccess: (res) => {
      setInviteId(res.data.invite.id);
      setResultLink(res.data.inviteLink);
      invalidateList();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Falha ao gerar link");
      onClose();
    },
  });

  useEffect(() => {
    if (open && !resultLink && !create.isPending) {
      create.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const regenerate = useMutation({
    mutationFn: () => ManagerInvitesAdminApi.regenerate(inviteId!),
    onSuccess: (res) => {
      setResultLink(res.data.inviteLink);
      toast.success("Novo link gerado — o anterior foi invalidado");
      invalidateList();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao regenerar"),
  });

  const revoke = useMutation({
    mutationFn: () => ManagerInvitesAdminApi.revoke(inviteId!),
    onSuccess: () => {
      setRevoked(true);
      toast.success("Convite revogado");
      invalidateList();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao revogar"),
  });

  const handleClose = () => {
    setInviteId(null);
    setResultLink(null);
    setRevoked(false);
    setCopied(false);
    onClose();
  };

  const copy = async () => {
    if (!resultLink) return;
    await navigator.clipboard.writeText(resultLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Link de convite gerado!"
      description="Copie o link e envie para o candidato — ele preenche o próprio cadastro ao abri-lo. O link não será exibido novamente."
    >
      <div className="flex flex-col gap-4">
        {create.isPending || !resultLink ? (
          <p className="text-sm text-text-muted text-center py-4">Gerando link...</p>
        ) : revoked ? (
          <p className="text-sm text-text-secondary text-center py-4">Este convite foi revogado.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-black/30 px-4 py-3">
              <p className="text-sm text-text-secondary truncate">{resultLink}</p>
              {copied ? <Check className="size-4 text-green shrink-0" /> : <Copy className="size-4 text-text-muted shrink-0" />}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" size="sm" onClick={copy}>
                <Copy className="size-4" /> Copiar
              </Button>
              <Button variant="secondary" size="sm" loading={regenerate.isPending} onClick={() => regenerate.mutate()}>
                <RotateCw className="size-4" /> Regenerar
              </Button>
              <Button variant="danger" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate()}>
                <Ban className="size-4" /> Revogar
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
