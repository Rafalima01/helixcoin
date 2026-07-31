"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ShieldAlert, Sliders } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/admin/ui";
import { GameConfigAdminApi, ApiError } from "@/lib/admin/game-config-api";
import { cn } from "@/lib/utils";

/**
 * Everything that used to be a read-only mock here (meta, apostas, comissões,
 * física) is now the real, editable module at /admin/rtp (see
 * src/modules/game-config). This page keeps only what's unrelated to game
 * economy — maintenance mode is a platform-availability switch, not a
 * gameplay/RTP parameter.
 */
export default function AdminGamePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gestão do Jogo"
        description="Parâmetros de economia, física e dificuldade foram movidos para o módulo dedicado."
      />

      <SectionCard
        title="Game Engine / RTP Control"
        description="Meta, apostas, modos Demo/Normal/Hard, física, geração de plataformas e anti-cheat"
      >
        <Link
          href="/rtp"
          className="flex items-center gap-3 rounded-xl border border-purple/25 bg-purple/5 px-4 py-3.5 text-sm font-semibold text-purple transition-colors hover:bg-purple/10"
        >
          <Sliders className="size-4" /> Ir para o módulo RTP
        </Link>
      </SectionCard>

      <SectionCard title="Modo de manutenção" description="Pausa novas partidas sem afetar as em andamento">
        <MaintenanceModeToggle />
      </SectionCard>
    </div>
  );
}

function MaintenanceModeToggle() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "game-config", "platform"],
    queryFn: () => GameConfigAdminApi.getPlatformConfig(),
  });
  const active = data?.data.maintenanceMode ?? false;

  const toggle = useMutation({
    mutationFn: () => GameConfigAdminApi.setMaintenanceMode(!active),
    onSuccess: (res) => {
      toast.success(res.data.maintenanceMode ? "Manutenção ativada — novas partidas bloqueadas." : "Manutenção desativada.");
      queryClient.invalidateQueries({ queryKey: ["admin", "game-config", "platform"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Falha ao alternar manutenção"),
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <ShieldAlert className={cn("size-4", active ? "text-warning" : "text-text-muted")} />
        <div>
          <p className="text-sm font-semibold">{active ? "Manutenção ativa" : "Plataforma operando normalmente"}</p>
          <p className="text-xs text-text-muted">
            {active ? "Novas partidas estão bloqueadas para os jogadores." : "Nenhuma janela de manutenção ativa"}
          </p>
        </div>
      </div>
      <button
        onClick={() => toggle.mutate()}
        disabled={isLoading || toggle.isPending}
        className={cn(
          "relative h-6 w-11 rounded-full border transition-colors disabled:opacity-50",
          active ? "border-warning/50 bg-warning/25" : "border-border bg-white/[0.06]"
        )}
        aria-label="Alternar manutenção"
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full transition-transform",
            active ? "translate-x-5 bg-warning" : "translate-x-0.5 bg-text-muted"
          )}
        />
      </button>
    </div>
  );
}
