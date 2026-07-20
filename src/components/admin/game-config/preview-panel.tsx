"use client";

import { useMemo } from "react";
import { Timer, Layers, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/ui";
import type { GameMode } from "@prisma/client";
import type { GeneralConfig, ModeProfile } from "@/modules/game-config/entities/game-economy-config.entity";
import { nearestPreset } from "@/modules/game-config/utils/difficulty-preset.util";

const MODE_LABEL: Record<GameMode, string> = { DEMO: "Demo", NORMAL: "Normal", HARD: "Hard" };

/** Matches the 5-tier legend requested for the preview: 🟢 Muito Fácil/Fácil, 🟡 Normal, 🟠 Difícil, 🔴 Muito Difícil. */
const PRESET_DISPLAY: Record<string, { emoji: string; tone: "success" | "warning" | "danger" }> = {
  very_easy: { emoji: "🟢", tone: "success" },
  easy: { emoji: "🟢", tone: "success" },
  normal: { emoji: "🟡", tone: "warning" },
  hard: { emoji: "🟠", tone: "warning" },
  very_hard: { emoji: "🔴", tone: "danger" },
};

/**
 * Crude inverse of the log-interpolated multiplier curve (see
 * src/lib/multiplier.ts) — good enough for an admin-facing estimate, not
 * meant to match the runtime curve to the decimal. Real curve stays
 * server-side; this never drives gameplay.
 */
function estimatePlatformsForMultiplier(target: number, min: number, max: number, totalPlatforms: number): number {
  if (target <= min) return 0;
  const safeMax = Math.max(max, min + 0.01);
  const ratio = Math.log(target / min) / Math.log(safeMax / min);
  return Math.round(Math.min(totalPlatforms, Math.max(0, ratio * totalPlatforms)));
}

export function PreviewPanel({
  mode,
  profile,
  general,
}: {
  mode: GameMode;
  profile: ModeProfile;
  general: GeneralConfig;
}) {
  const stats = useMemo(() => {
    const totalPlatforms = Number(profile.totalPlatforms ?? 44);
    const avgPlatforms = estimatePlatformsForMultiplier(
      general.targetMultiplierDefault,
      general.goalMultiplierMin,
      general.goalMultiplierMax,
      totalPlatforms
    );

    const baseSecondsPerPlatform = 0.7;
    const ballSpeed = Number(profile.ballSpeed ?? 15);
    const speedFactor = Math.min(2, Math.max(0.5, ballSpeed / 15));
    const avgTimeSeconds = Math.round((avgPlatforms * baseSecondsPerPlatform) / speedFactor);

    // "Não precisa ser um cálculo complexo. Pode ser apenas baseado no
    // preset atual." — whichever tuned preset this profile most resembles.
    const preset = nearestPreset(profile);
    const display = PRESET_DISPLAY[preset.key];

    return { avgPlatforms, avgTimeSeconds, totalPlatforms, preset, display };
  }, [profile, general]);

  return (
    <Card className="sticky top-4 flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Sparkles className="size-4 text-purple" /> Preview em tempo real
        </p>
        <StatusBadge tone="info">{MODE_LABEL[mode]}</StatusBadge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-white/[0.02] p-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-text-muted">
            <Layers className="size-3" /> Plataformas até a meta
          </p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">
            ~{stats.avgPlatforms}
            <span className="text-xs font-normal text-text-muted"> / {stats.totalPlatforms}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white/[0.02] p-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-text-muted">
            <Timer className="size-3" /> Tempo médio estimado
          </p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">~{stats.avgTimeSeconds}s</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white/[0.02] p-3">
        <p className="text-[10px] uppercase tracking-wide text-text-muted">Dificuldade estimada</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg">{stats.display.emoji}</span>
          <StatusBadge tone={stats.display.tone}>{stats.preset.label}</StatusBadge>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-text-muted">
        Estimativa aproximada calculada no navegador a partir dos valores do rascunho — não reflete a curva exata
        usada em produção, apenas uma referência para ajuste rápido.
      </p>
    </Card>
  );
}
