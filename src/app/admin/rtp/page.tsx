"use client";

import { useState } from "react";
import { Percent, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, AdminTabs, StatusBadge } from "@/components/admin/ui";

const TABS = [
  { key: "overview", label: "Visão Geral" },
  { key: "profiles", label: "Perfis" },
  { key: "rules", label: "Regras" },
  { key: "history", label: "Histórico" },
];

function Placeholder({ section }: { section: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-white/[0.03]">
        <Lock className="size-5 text-text-muted" />
      </span>
      <p className="font-bold">{section}</p>
      <p className="max-w-md text-sm text-text-secondary leading-relaxed">
        A estrutura deste módulo está reservada. As regras de funcionamento do RTP serão fornecidas
        em uma fase específica e implementadas integralmente no Backend — nenhum comportamento foi
        assumido nesta etapa.
      </p>
      <StatusBadge tone="neutral">Aguardando especificação</StatusBadge>
    </Card>
  );
}

/**
 * RTP module — Phase 1 scaffolding ONLY.
 * Navigation, layout and visual structure. No logic, no assumptions: the
 * functional specification will be provided in a dedicated phase.
 */
export default function AdminRtpPage() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Módulo RTP"
        description="Estrutura visual do módulo de RTP. Lógica e regras serão definidas em fase posterior."
        actions={<StatusBadge tone="warning">Fase futura</StatusBadge>}
      />

      <AdminTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          {["RTP configurado", "RTP efetivo", "Janela de medição"].map((label) => (
            <Card key={label} className="p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-text-muted">
                <Percent className="size-3" /> {label}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-text-muted">—</p>
              <p className="mt-1 text-[11px] text-text-muted">Definido em fase posterior</p>
            </Card>
          ))}
          <div className="md:col-span-3">
            <Placeholder section="Visão geral do RTP" />
          </div>
        </div>
      )}
      {tab === "profiles" && <Placeholder section="Perfis de RTP" />}
      {tab === "rules" && <Placeholder section="Regras de RTP" />}
      {tab === "history" && <Placeholder section="Histórico de alterações" />}
    </div>
  );
}
