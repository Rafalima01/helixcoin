"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DetailRow } from "@/components/admin/ui";
import { ManagerInvitesAdminApi, ApiError } from "@/lib/admin/affiliate-api";

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

export function RequestDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [commissionPercent, setCommissionPercent] = useState("70");
  const [rejectReason, setRejectReason] = useState("");
  const [confirmingReject, setConfirmingReject] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "manager", "invite-detail", id],
    queryFn: () => ManagerInvitesAdminApi.get(id),
  });
  const invite = data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "manager", "invite-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "manager", "requests", "pending"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "manager", "list"] });
  };

  const approve = useMutation({
    mutationFn: () => ManagerInvitesAdminApi.approve(id, Number(commissionPercent)),
    onSuccess: () => {
      toast.success("Gerente aprovado — acesso liberado");
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao aprovar"),
  });

  const reject = useMutation({
    mutationFn: () => ManagerInvitesAdminApi.reject(id, rejectReason.trim()),
    onSuccess: () => {
      toast.success("Solicitação reprovada");
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao reprovar"),
  });

  return (
    <Drawer open onClose={onClose} title={invite ? "Solicitação de Gerente" : "Carregando..."}>
      {isLoading || !invite ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <DetailRow label="Nome" value={invite.name} />
            <DetailRow label="Email" value={invite.email} />
            <DetailRow label="Telefone" value={invite.phone ?? "—"} />
            <DetailRow label="Data da solicitação" value={formatDate(invite.acceptedAt)} />
            <DetailRow label="IP" value={invite.acceptedIp ?? "—"} />
            <DetailRow label="Navegador" value={invite.acceptedUserAgent ?? "—"} />
            <DetailRow label="Link utilizado" value={<code className="text-xs">/manager-invite/{"{token}"}</code>} />
            <DetailRow label="Convidado por" value={invite.createdByName} />
          </div>

          {invite.approvalStatus === "PENDING_REVIEW" ? (
            confirmingReject ? (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <label className="text-sm font-medium text-text-secondary">Motivo da reprovação</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-[15px] outline-none focus:border-purple/60"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirmingReject(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    loading={reject.isPending}
                    disabled={rejectReason.trim().length < 3}
                    onClick={() => reject.mutate()}
                  >
                    Confirmar reprovação
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <label className="text-sm font-medium text-text-secondary">Comissão máxima (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                  hint="Teto de comissão do gerente — afiliados dele nunca poderão exceder esse percentual."
                />
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" className="flex-1" onClick={() => setConfirmingReject(true)}>
                    Reprovar
                  </Button>
                  <Button variant="success" size="sm" className="flex-1" loading={approve.isPending} onClick={() => approve.mutate()}>
                    Aprovar
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="border-t border-border pt-4">
              <DetailRow label="Status" value={invite.approvalStatus === "APPROVED" ? "Aprovado" : "Reprovado"} />
              {invite.rejectionReason && <DetailRow label="Motivo" value={invite.rejectionReason} />}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
