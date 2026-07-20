"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Laptop, MonitorX, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessions, useRevokeSession, useRevokeAllSessions, type SessionInfo } from "@/hooks/use-profile";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function SessionRow({ session, onRevoke, revoking }: { session: SessionInfo; onRevoke: () => void; revoking: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white/[0.02] px-4 py-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple">
          <Laptop className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {session.browser ?? "Navegador"} · {session.os ?? "SO desconhecido"}
            {session.current && (
              <span className="ml-2 rounded-full bg-green/15 border border-green/25 px-2 py-0.5 text-[10px] font-bold text-green">
                Este dispositivo
              </span>
            )}
          </p>
          <p className="text-xs text-text-muted truncate">{session.ip ?? "IP desconhecido"}</p>
          <p className="text-xs text-text-muted">Ativo em {formatDate(session.lastActivityAt)}</p>
        </div>
      </div>
      {!session.current && session.active && (
        <Button variant="secondary" size="sm" loading={revoking} onClick={onRevoke}>
          <MonitorX className="size-4" /> Encerrar
        </Button>
      )}
    </div>
  );
}

export function SessionsSection() {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useSessions();
  const revoke = useRevokeSession();
  const revokeAll = useRevokeAllSessions();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sessions"] });

  const handleRevoke = async (sessionId: string) => {
    try {
      await revoke.mutateAsync(sessionId);
      toast.success("Sessão encerrada");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao encerrar sessão");
    }
  };

  const handleRevokeAll = async () => {
    try {
      const result = await revokeAll.mutateAsync();
      toast.success(`${result.revokedCount} sessão(ões) encerrada(s)`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao encerrar sessões");
    }
  };

  const active = (sessions ?? []).filter((s) => s.active);
  const otherActive = active.filter((s) => !s.current);

  return (
    <Card className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">Sessões ativas</p>
          <p className="text-xs text-text-secondary">Dispositivos conectados à sua conta.</p>
        </div>
        {otherActive.length > 0 && (
          <Button variant="danger" size="sm" loading={revokeAll.isPending} onClick={handleRevokeAll}>
            <LogOut className="size-4" /> Sair de todos os outros
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : active.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhuma sessão ativa encontrada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((s) => (
            <SessionRow key={s.id} session={s} onRevoke={() => handleRevoke(s.id)} revoking={revoke.isPending} />
          ))}
        </div>
      )}
    </Card>
  );
}
