"use client";

import { useState } from "react";
import { ClipboardCheck, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/admin/ui";
import { ListRow, ListRowAvatar } from "@/components/backoffice/list-row";
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
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma aprovação pendente"
          description="Novos cadastros de afiliados da sua rede aparecerão aqui."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((app) => (
            <ListRow
              key={app.id}
              leading={<ListRowAvatar>{app.userName.charAt(0).toUpperCase()}</ListRowAvatar>}
              title={app.userName}
              subtitle={app.userEmail}
              meta={`Solicitado em ${new Date(app.requestedAt).toLocaleDateString("pt-BR")}`}
              trailing={
                <>
                  <Button variant="success" size="sm" onClick={() => approve(app.id)} loading={decide.isPending}>
                    <Check className="size-4" /> Aprovar
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setRejectingId(app.id)}>
                    <X className="size-4" /> Recusar
                  </Button>
                </>
              }
            />
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
