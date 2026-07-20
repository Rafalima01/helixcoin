"use client";

import { Save, Target, Gauge, Timer, Flame, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionCard, StatusBadge } from "@/components/admin/ui";
import { notImplemented } from "@/lib/admin/use-admin-data";

/**
 * Game management — Phase 1 mockup. Every control is read-only; the values
 * shown mirror the current GameConfig and will be persisted via API + audit
 * trail in a later phase.
 */
export default function AdminGamePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gestão do Jogo"
        description="Parâmetros globais do HeliJump. Alterações serão versionadas, auditadas e aplicadas em tempo real pelo Backend."
        actions={
          <Button variant="primary" size="sm" onClick={notImplemented}>
            <Save className="size-4" /> Salvar alterações
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Meta e resgate"
          description="Regras que controlam quando o jogador pode resgatar"
          actions={
            <StatusBadge tone="success" pulse>
              Em produção
            </StatusBadge>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Meta global (multiplicador)"
              value="5.00x"
              readOnly
              hint="Aplicada a todas as novas partidas"
            />
            <Input label="Aposta mínima" value="R$ 1,00" readOnly />
            <Input label="Aposta máxima" value="R$ 500,00" readOnly />
            <Input label="Plataformas máximas" value="160" readOnly />
          </div>
        </SectionCard>

        <SectionCard title="Comissões de afiliados" description="Percentuais por nível da rede">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Nível 1" value="10%" readOnly />
            <Input label="Nível 2" value="5%" readOnly />
            <Input label="Nível 3" value="2%" readOnly />
          </div>
          <p className="mt-3 text-[11px] text-text-muted">
            Os valores acima refletem o GameConfig atual e serão editáveis com trilha de auditoria.
          </p>
        </SectionCard>

        <SectionCard
          title="Física e dificuldade"
          description="Curva de gameplay (somente leitura nesta fase)"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Gauge, label: "Gravidade", value: "-16 m/s²" },
              { icon: Timer, label: "Velocidade máx. de queda", value: "15 u/s" },
              { icon: Target, label: "Segmentos por anel", value: "12" },
              { icon: Flame, label: "Fire Mode (passes)", value: "3 consecutivos" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-xl border border-border bg-white/[0.02] px-3.5 py-3"
              >
                <f.icon className="size-4 shrink-0 text-purple" />
                <div className="min-w-0">
                  <p className="text-[11px] text-text-muted">{f.label}</p>
                  <p className="text-sm font-bold">{f.value}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Modo de manutenção"
          description="Pausa novas partidas sem afetar as em andamento"
        >
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
    </div>
  );
}
