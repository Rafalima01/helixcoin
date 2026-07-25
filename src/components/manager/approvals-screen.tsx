"use client";

import { useState } from "react";
import { ClipboardCheck, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useManagerApprovals, useDecideApproval } from "@/hooks/use-manager";

function RejectModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Recusar cadastro" description="Informe o motivo da recusa.">
      <div className="flex flex-col gap-4">
        <Input
          label="Motivo"
          placeholder="Ex: documentos inconsistentes"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button
          variant="danger"
          size="lg"
          loading={loading}
          onClick={() => {
            if (reason.trim().length < 3) {
              toast.error("Informe um motivo com pelo menos 3 caracteres");
              return;
            }
            onConfirm(reason.trim());
          }}
        >
          Confirmar recusa
        </Button>
      </div>
    </Modal>
  );
}

export function ManagerApprovalsScreen() {
  const { data, isLoading } = useManagerApprovals();
  const decide = useDecideApproval();
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const approve = async (id: string) => {
    try {
      await decide.mutateAsync({ id, action: "APPROVE" });
      toast.success("Afiliado aprovado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar");
    }
  };

  const reject = async (reason: string) => {
    if (!rejectingId) return;
    try {
      await decide.mutateAsync({ id: rejectingId, action: "REJECT", reason });
      toast.success("Solicitação recusada");
      setRejectingId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao recusar");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Aprovaç<span className="text-gradient-brand">ões</span>
        </h1>
        <p className="text-text-secondary mt-2">Cadastros de afiliados da sua rede aguardando decisão.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-3 text-center">
          <ClipboardCheck className="size-8 text-text-muted" />
          <p className="font-semibold">Nenhuma aprovação pendente</p>
          <p className="text-sm text-text-secondary max-w-sm">
            Novos cadastros de afiliados da sua rede aparecerão aqui.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((app) => (
            <Card key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple font-bold">
                {app.userName.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{app.userName}</p>
                <p className="text-xs text-text-secondary truncate">{app.userEmail}</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Solicitado em {new Date(app.requestedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="success" size="sm" onClick={() => approve(app.id)} loading={decide.isPending}>
                  <Check className="size-4" /> Aprovar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setRejectingId(app.id)}>
                  <X className="size-4" /> Recusar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <RejectModal
        open={rejectingId !== null}
        onClose={() => setRejectingId(null)}
        onConfirm={reject}
        loading={decide.isPending}
      />
    </div>
  );
}
