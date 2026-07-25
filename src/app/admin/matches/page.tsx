"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  DataTable,
  FilterBar,
  FilterChips,
  StatusBadge,
  Drawer,
  DetailRow,
  AdminTabs,
  type TableColumn,
} from "@/components/admin/ui";
import { MatchesAdminApi } from "@/lib/admin/matches-api";
import type { MatchSummaryDto, MatchDetailDto, MatchEventDto } from "@/modules/match-engine/dto/match.dto";
import { formatCurrency } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "pink";

const STATUS_LABEL: Record<string, { label: string; tone: Tone; pulse?: boolean }> = {
  CREATED: { label: "Criada", tone: "neutral" },
  AWAITING_START: { label: "Aguardando início", tone: "info" },
  IN_PROGRESS: { label: "Em andamento", tone: "info", pulse: true },
  GOAL_REACHED: { label: "Meta atingida", tone: "success" },
  CASHOUT_AVAILABLE: { label: "Resgate disponível", tone: "success", pulse: true },
  CASHED_OUT: { label: "Resgatada", tone: "success" },
  LOST: { label: "Derrota", tone: "danger" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
  INVALIDATED: { label: "Invalidada (Anti-Cheat)", tone: "pink" },
};

const MODE_LABEL: Record<string, string> = {
  DEMO: "Demo",
  NORMAL: "Normal",
  HARD: "Difícil",
};

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Partida criada",
  STARTED: "Partida iniciada",
  PROGRESSED: "Checkpoint de progresso",
  GOAL_REACHED: "Meta atingida",
  CASHOUT_REQUESTED: "Resgate solicitado",
  CASHOUT_APPROVED: "Resgate aprovado",
  CASHOUT_DENIED: "Resgate negado",
  COMPLETED: "Partida encerrada (resgatada)",
  LOST: "Partida encerrada (derrota)",
  CANCELLED: "Partida cancelada",
  INVALIDATED: "Partida invalidada",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function formatCents(cents: number | null) {
  if (cents === null) return "—";
  return formatCurrency(cents / 100);
}

function statusBadge(status: string) {
  const s = STATUS_LABEL[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <StatusBadge tone={s.tone} pulse={s.pulse}>
      {s.label}
    </StatusBadge>
  );
}

export default function AdminMatchesPage() {
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "matches", userId, status, mode],
    queryFn: () => MatchesAdminApi.listMatches({ userId, status, mode, page: 1, pageSize: 100 }),
  });

  const rows = data?.data ?? [];

  const columns: TableColumn<MatchSummaryDto>[] = useMemo(
    () => [
      {
        key: "matchNumber",
        header: "Partida",
        render: (m) => (
          <div className="min-w-0">
            <p className="font-semibold truncate">{m.matchNumber}</p>
            <p className="text-xs text-text-muted truncate">{MODE_LABEL[m.mode] ?? m.mode}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (m) => statusBadge(m.status),
      },
      {
        key: "betAmount",
        header: "Aposta",
        align: "right",
        render: (m) => <span className="text-sm tabular-nums">{formatCents(m.betAmount)}</span>,
      },
      {
        key: "multiplier",
        header: "Multiplicador",
        align: "right",
        render: (m) => <span className="text-sm tabular-nums">{m.multiplier.toFixed(2)}×</span>,
      },
      {
        key: "payout",
        header: "Resultado",
        align: "right",
        render: (m) => <span className="text-sm tabular-nums">{formatCents(m.payout)}</span>,
      },
      {
        key: "platformsPassed",
        header: "Plataformas",
        align: "right",
        render: (m) => <span className="text-xs text-text-secondary tabular-nums">{m.platformsPassed}</span>,
      },
      {
        key: "riskScore",
        header: "Risco",
        align: "right",
        render: (m) => (
          <span
            className={
              m.riskScore >= 60
                ? "text-xs font-semibold text-error tabular-nums"
                : m.riskScore >= 30
                  ? "text-xs font-semibold text-warning tabular-nums"
                  : "text-xs text-text-muted tabular-nums"
            }
          >
            {m.riskScore}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: "Criada em",
        align: "right",
        render: (m) => <span className="text-xs text-text-muted">{formatDate(m.createdAt)}</span>,
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Partidas"
        description="Consulta somente-leitura do motor de partidas — dados reais via src/modules/match-engine. Nenhuma ação de edição é permitida aqui."
      />

      <FilterBar search={userId} onSearch={setUserId} placeholder="Filtrar por ID do usuário...">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Todos os status" },
              { value: "IN_PROGRESS", label: "Em andamento" },
              { value: "CASHED_OUT", label: "Resgatadas" },
              { value: "LOST", label: "Derrotas" },
              { value: "CANCELLED", label: "Canceladas" },
              { value: "INVALIDATED", label: "Invalidadas" },
            ]}
          />
          <FilterChips
            value={mode}
            onChange={setMode}
            options={[
              { value: "all", label: "Todos os modos" },
              { value: "DEMO", label: "Demo" },
              { value: "NORMAL", label: "Normal" },
              { value: "HARD", label: "Difícil" },
            ]}
          />
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        onRowClick={(m) => setSelectedId(m.id)}
        emptyMessage="Nenhuma partida corresponde aos filtros"
      />

      {selectedId && <MatchDrawer matchId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function MatchDrawer({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [tab, setTab] = useState("detalhes");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "match", matchId],
    queryFn: () => MatchesAdminApi.getMatch(matchId),
  });
  const match = data?.data;

  return (
    <Drawer open onClose={onClose} title={match?.matchNumber ?? "Carregando..."}>
      {isLoading || !match ? (
        <p className="text-sm text-text-muted">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <AdminTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "detalhes", label: "Detalhes" },
              { key: "timeline", label: "Timeline" },
              { key: "configuracao", label: "Configuração" },
            ]}
          />

          {tab === "detalhes" && <MatchDetailsTab match={match} />}
          {tab === "timeline" && <MatchTimelineTab events={match.events} />}
          {tab === "configuracao" && <MatchConfigTab match={match} />}

          <p className="text-[11px] text-text-muted">
            Consulta somente-leitura — partidas nunca podem ser editadas pelo backoffice.
          </p>
        </div>
      )}
    </Drawer>
  );
}

function MatchDetailsTab({ match }: { match: MatchDetailDto }) {
  return (
    <div>
      <DetailRow label="ID da partida" value={<code className="text-xs">{match.id}</code>} />
      <DetailRow label="Usuário" value={<code className="text-xs">{match.userId}</code>} />
      <DetailRow label="Status" value={statusBadge(match.status)} />
      <DetailRow label="Modo" value={MODE_LABEL[match.mode] ?? match.mode} />
      <DetailRow label="Aposta" value={formatCents(match.betAmount)} />
      <DetailRow label="Meta (multiplicador)" value={`${match.targetMultiplier.toFixed(2)}×`} />
      <DetailRow label="Valor da meta" value={formatCents(match.goalAmount)} />
      <DetailRow label="Multiplicador atual" value={`${match.multiplier.toFixed(2)}×`} />
      <DetailRow label="Resgate potencial" value={formatCents(match.potentialPayout)} />
      <DetailRow label="Payout final" value={formatCents(match.payout)} />
      <DetailRow label="Saldo antes" value={formatCents(match.balanceBefore)} />
      <DetailRow label="Saldo depois" value={formatCents(match.balanceAfter)} />
      <DetailRow label="Plataformas ultrapassadas" value={match.platformsPassed} />
      <DetailRow label="Maior sequência sem erro" value={match.longestStreak} />
      <DetailRow label="Colisões" value={match.collisionCount} />
      <DetailRow label="Velocidade média" value={match.avgSpeed?.toFixed(2) ?? "—"} />
      <DetailRow
        label="Score de risco (Anti-Cheat)"
        value={
          <span
            className={
              match.riskScore >= 60 ? "text-error" : match.riskScore >= 30 ? "text-warning" : undefined
            }
          >
            {match.riskScore}/100
          </span>
        }
      />
      <DetailRow label="Motivo de invalidação" value={match.invalidationReason ?? "—"} />
      <DetailRow label="Versão do Engine" value={match.engineVersion ?? "—"} />
      <DetailRow label="Seed" value={<code className="text-xs">{match.seed}</code>} />
      <DetailRow label="IP" value={match.ip ?? "—"} />
      <DetailRow label="Dispositivo" value={match.device ?? "—"} />
      <DetailRow label="Sistema operacional" value={match.os ?? "—"} />
      <DetailRow label="Duração" value={match.durationSeconds !== null ? `${match.durationSeconds}s` : "—"} />
      <DetailRow label="Criada em" value={formatDate(match.createdAt)} />
      <DetailRow label="Iniciada em" value={formatDate(match.startedAt)} />
      <DetailRow label="Resolvida em" value={formatDate(match.resolvedAt)} />
      <DetailRow label="Atualizada em" value={formatDate(match.updatedAt)} />
    </div>
  );
}

function MatchTimelineTab({ events }: { events: MatchEventDto[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-text-muted">Nenhum evento registrado.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {events.map((e) => (
        <div key={e.id} className="rounded-xl border border-border bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{EVENT_LABEL[e.type] ?? e.type}</p>
            <p className="text-xs text-text-muted whitespace-nowrap">{formatDate(e.createdAt)}</p>
          </div>
          {e.payload && (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-black/30 p-2 text-[11px] text-text-secondary">
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function MatchConfigTab({ match }: { match: MatchDetailDto }) {
  return (
    <div>
      <DetailRow label="Versão da config" value={match.configVersion ?? "—"} />
      <DetailRow label="Preset base" value={match.presetKey ?? "Personalizado"} />
      <div className="mt-4 flex flex-col gap-3">
        <ConfigBlock title="Parâmetros do Engine (snapshot)" value={match.engineParams} />
        <ConfigBlock title="Snapshot de metas/limites" value={match.goalSnapshot} />
        <ConfigBlock title="Snapshot Anti-Cheat" value={match.antiCheatSnapshot} />
      </div>
    </div>
  );
}

function ConfigBlock({ title, value }: { title: string; value: unknown }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-text-muted">{title}</p>
      <pre className="overflow-x-auto rounded-lg bg-black/30 p-2 text-[11px] text-text-secondary">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
