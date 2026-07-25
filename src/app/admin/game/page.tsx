"use client";

import Link from "next/link";
import { ShieldAlert, Sliders } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/admin/ui";
import { notImplemented } from "@/lib/admin/use-admin-data";

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
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.02] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-4 text-warning" />
            <div>
              <p className="text-sm font-semibold">Manutenção programada</p>
              <p className="text-xs text-text-muted">Nenhuma janela agendada</p>
            </div>
          </div>
          <button
            onClick={notImplemented}
            className="relative h-6 w-11 rounded-full border border-border bg-white/[0.06] transition-colors"
            aria-label="Alternar manutenção"
          >
            <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-text-muted transition-transform" />
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
