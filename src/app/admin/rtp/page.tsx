"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Save, Rocket, RotateCcw } from "lucide-react";
import type { GameMode } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { PageHeader, AdminTabs, StatusBadge, SectionCard, DataTable, type TableColumn } from "@/components/admin/ui";
import { NumberConfigField, BooleanConfigField } from "@/components/admin/game-config/config-field";
import { QuickBetEditor } from "@/components/admin/game-config/quick-bet-editor";
import { PreviewPanel } from "@/components/admin/game-config/preview-panel";
import { GameConfigAdminApi } from "@/lib/admin/game-config-api";
import {
  MODE_FIELDS,
  GENERAL_FIELDS,
  ANTI_CHEAT_FIELDS,
  GAME_MODES,
  DIFFICULTY_PRESETS,
  type FieldSection,
  type GeneralFieldKey,
  type AntiCheatFieldKey,
  type DifficultyPreset,
} from "@/modules/game-config/constants/field-registry";
import {
  buildDefaultGeneral,
  buildDefaultModes,
  buildDefaultAntiCheat,
} from "@/modules/game-config/utils/config-defaults.util";
import { currentPreset } from "@/modules/game-config/utils/difficulty-preset.util";
import type {
  GeneralConfig,
  AntiCheatConfig,
  ModeProfile,
} from "@/modules/game-config/entities/game-economy-config.entity";
import type { GameEconomyConfigVersionSummaryDto } from "@/modules/game-config/dto/game-economy-config.dto";
import { cn } from "@/lib/utils";

interface FormState {
  general: GeneralConfig;
  modes: Record<GameMode, ModeProfile>;
  antiCheat: AntiCheatConfig;
}

const TABS = [
  { key: "general", label: "Geral" },
  { key: "DEMO", label: "Demo" },
  { key: "NORMAL", label: "Normal" },
  { key: "HARD", label: "Hard" },
  { key: "goals", label: "Metas" },
  { key: "anticheat", label: "Anti-Cheat" },
  { key: "versions", label: "Versões" },
];

const generalField = (key: GeneralFieldKey) => GENERAL_FIELDS.find((f) => f.key === key)!;
const antiCheatField = (key: AntiCheatFieldKey) => ANTI_CHEAT_FIELDS.find((f) => f.key === key)!;

const SECTION_LABEL: Record<FieldSection, string> = {
  physics: "Física da bola",
  generation: "Estrutura das plataformas",
};

const MODE_LABEL_PAIRS: [GameMode, string][] = [
  ["DEMO", "Demo"],
  ["NORMAL", "Normal"],
  ["HARD", "Hard"],
];

function presetLabel(profile: ModeProfile): string {
  return currentPreset(profile)?.label ?? "Personalizado";
}

function buildInitialForm(source: {
  general: GeneralConfig;
  modes: Record<GameMode, ModeProfile>;
  antiCheat: AntiCheatConfig;
} | null): FormState {
  return source
    ? { general: source.general, modes: source.modes, antiCheat: source.antiCheat }
    : { general: buildDefaultGeneral(), modes: buildDefaultModes(), antiCheat: buildDefaultAntiCheat() };
}

/**
 * Game Engine / RTP Control — the single admin surface for every gameplay
 * and economy knob. The frontend player app never hardcodes any of this: it
 * receives the active version's mode profile at match start and simply
 * renders it (see src/game-engine/config.ts and this module's README).
 */
export default function AdminRtpPage() {
  const [reloadKey, setReloadKey] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "game-config"],
    queryFn: () => GameConfigAdminApi.get(),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Game Engine / RTP Control" description="Carregando configuração..." />
      </div>
    );
  }

  return (
    <RtpConfigEditor
      key={reloadKey}
      active={data.data.active}
      draft={data.data.draft}
      onReload={() => setReloadKey((k) => k + 1)}
    />
  );
}

function RtpConfigEditor({
  active,
  draft,
  onReload,
}: {
  active: FormState & { version: number } | null;
  draft: (FormState & { version: number }) | null;
  onReload: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("general");
  const [form, setForm] = useState<FormState>(() => buildInitialForm(draft ?? active));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  const { data: versionsData, isLoading: versionsLoading, isError: versionsError, refetch: versionsRefetch } = useQuery({
    queryKey: ["admin", "game-config", "versions"],
    queryFn: () => GameConfigAdminApi.listVersions(1, 50),
    enabled: tab === "versions",
  });

  const updateGeneral = <K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]) => {
    setForm((f) => ({ ...f, general: { ...f.general, [key]: value } }));
    setDirty(true);
  };

  const updateMode = (mode: GameMode, key: string, value: number | boolean) => {
    setForm((f) => ({ ...f, modes: { ...f.modes, [mode]: { ...f.modes[mode], [key]: value } } }));
    setDirty(true);
  };

  const updateAntiCheat = (key: AntiCheatFieldKey, value: number) => {
    setForm((f) => ({ ...f, antiCheat: { ...f.antiCheat, [key]: value } }));
    setDirty(true);
  };

  const persistDraft = async () => {
    await GameConfigAdminApi.saveDraft({ general: form.general, modes: form.modes, antiCheat: form.antiCheat });
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await persistDraft();
      toast.success("Rascunho salvo");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "game-config"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar rascunho");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      if (dirty) await persistDraft();
      await GameConfigAdminApi.activate();
      toast.success("Configuração ativada");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "game-config"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ativar configuração");
    } finally {
      setActivating(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    try {
      await GameConfigAdminApi.restoreVersion(versionId);
      toast.success("Versão restaurada para um novo rascunho");
      setTab("general");
      queryClient.invalidateQueries({ queryKey: ["admin", "game-config"] });
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao restaurar versão");
    }
  };

  const activeVersion = active?.version ?? null;
  const draftVersion = draft?.version ?? null;
  const currentModeTab = (GAME_MODES as string[]).includes(tab) ? (tab as GameMode) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Game Engine / RTP Control"
        description="Centro de controle da economia e dificuldade do jogo. O frontend não tem nenhuma regra fixa — cada partida recebe estes parâmetros diretamente do backend."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeVersion && <StatusBadge tone="success">v{activeVersion} ativa</StatusBadge>}
            {draftVersion && <StatusBadge tone="warning">v{draftVersion} rascunho</StatusBadge>}
            {dirty && <StatusBadge tone="info">Alterações não salvas</StatusBadge>}
            <Button variant="secondary" size="sm" onClick={handleSaveDraft} loading={saving}>
              <Save className="size-4" /> Salvar rascunho
            </Button>
            <Button variant="primary" size="sm" onClick={handleActivate} loading={activating}>
              <Rocket className="size-4" /> Ativar
            </Button>
          </div>
        }
      />

      <AdminTabs tabs={TABS} value={tab} onChange={setTab} />

      <div className={currentModeTab ? "grid gap-4 lg:grid-cols-[1fr_320px]" : "flex flex-col gap-4"}>
        <div className="flex flex-col gap-4">
          {tab === "general" && <GeneralTab form={form} onChange={updateGeneral} />}
          {currentModeTab && (
            <ModeTab mode={currentModeTab} profile={form.modes[currentModeTab]} onChange={updateMode} />
          )}
          {tab === "goals" && <GoalsTab form={form} onChange={updateGeneral} />}
          {tab === "anticheat" && <AntiCheatTab antiCheat={form.antiCheat} onChange={updateAntiCheat} />}
          {tab === "versions" && (
            <VersionsTab
              versions={versionsData?.data ?? []}
              loading={versionsLoading}
              error={versionsError}
              onRetry={versionsRefetch}
              onRestore={handleRestore}
            />
          )}
        </div>
        {currentModeTab && (
          <PreviewPanel mode={currentModeTab} profile={form.modes[currentModeTab]} general={form.general} />
        )}
      </div>
    </div>
  );
}

function GeneralTab({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]) => void;
}) {
  const targetMultiplier = generalField("targetMultiplierDefault");
  const betMin = generalField("betMin");
  const betMax = generalField("betMax");
  const threshold = generalField("hardModeBalanceThreshold");

  return (
    <>
      <SectionCard title="Meta e apostas" description="Parâmetros gerais aplicados a todas as partidas">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberConfigField
            label={targetMultiplier.label}
            tooltip={targetMultiplier.tooltip}
            value={form.general.targetMultiplierDefault}
            defaultValue={targetMultiplier.default}
            min={targetMultiplier.min}
            max={targetMultiplier.max}
            step={targetMultiplier.step}
            onChange={(v) => onChange("targetMultiplierDefault", v)}
          />
          <NumberConfigField
            label={betMin.label}
            tooltip={betMin.tooltip}
            unit={betMin.unit}
            value={form.general.betMin}
            defaultValue={betMin.default}
            min={betMin.min}
            max={betMin.max}
            step={betMin.step}
            onChange={(v) => onChange("betMin", v)}
          />
          <NumberConfigField
            label={betMax.label}
            tooltip={betMax.tooltip}
            unit={betMax.unit}
            value={form.general.betMax}
            defaultValue={betMax.default}
            min={betMax.min}
            max={betMax.max}
            step={betMax.step}
            onChange={(v) => onChange("betMax", v)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Botões de aposta rápida"
        description="Valores exibidos no jogo — adicionar, editar, remover e reordenar"
      >
        <QuickBetEditor
          amounts={form.general.quickBetAmounts}
          onChange={(amounts) => onChange("quickBetAmounts", amounts)}
        />
      </SectionCard>

      <SectionCard title="Modo Hard automático" description="A dificuldade sobe sozinha conforme o saldo cresce">
        <div className="mb-3 rounded-xl border border-purple/25 bg-purple/5 p-3 text-xs leading-relaxed text-text-secondary">
          <strong className="text-white">Saldo Total = Saldo atual + Total já sacado.</strong> Quando esse valor
          atinge o limite abaixo, o jogador entra automaticamente no Modo Hard. Defina <strong>0</strong> para
          desativar completamente este recurso — todos permanecem em Modo Normal, exceto contas marcadas
          manualmente como Demo.
        </div>
        <NumberConfigField
          label={threshold.label}
          tooltip={threshold.tooltip}
          unit={threshold.unit}
          value={form.general.hardModeBalanceThreshold}
          defaultValue={threshold.default}
          min={threshold.min}
          max={threshold.max}
          step={threshold.step}
          onChange={(v) => onChange("hardModeBalanceThreshold", v)}
        />
      </SectionCard>
    </>
  );
}

function ModeTab({
  mode,
  profile,
  onChange,
}: {
  mode: GameMode;
  profile: ModeProfile;
  onChange: (mode: GameMode, key: string, value: number | boolean) => void;
}) {
  const sections: FieldSection[] = ["physics", "generation"];
  const active = currentPreset(profile);

  const applyPreset = (preset: DifficultyPreset) => {
    for (const [key, value] of Object.entries(preset.values)) {
      onChange(mode, key, value);
    }
  };

  return (
    <>
      <SectionCard
        title="Preset atual"
        description="Aplicar um preset preenche todos os valores de uma vez. Alterar qualquer campo manualmente muda automaticamente para Personalizado."
      >
        <div className="flex flex-col gap-1.5">
          {DIFFICULTY_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              title={preset.description}
              onClick={() => applyPreset(preset)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left text-sm font-semibold transition-all",
                active?.key === preset.key
                  ? "border-purple bg-purple/15 text-white"
                  : "border-border bg-white/[0.02] text-text-secondary hover:border-border-strong hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded-full border-2",
                  active?.key === preset.key ? "border-purple" : "border-text-muted"
                )}
              >
                {active?.key === preset.key && <span className="size-1.5 rounded-full bg-purple" />}
              </span>
              {preset.label}
            </button>
          ))}
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm font-semibold",
              active === null
                ? "border-purple bg-purple/15 text-white"
                : "border-border bg-white/[0.02] text-text-muted"
            )}
          >
            <span
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded-full border-2",
                active === null ? "border-purple" : "border-text-muted"
              )}
            >
              {active === null && <span className="size-1.5 rounded-full bg-purple" />}
            </span>
            Personalizado
          </div>
        </div>
      </SectionCard>

      {sections.map((section) => {
        const fields = MODE_FIELDS.filter((f) => f.section === section);
        if (fields.length === 0) return null;
        return (
          <SectionCard key={section} title={SECTION_LABEL[section]}>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) =>
                f.kind === "boolean" ? (
                  <BooleanConfigField
                    key={f.key}
                    label={f.label}
                    tooltip={f.tooltip}
                    value={Boolean(profile[f.key])}
                    defaultValue={Boolean(f.defaults[mode])}
                    onChange={(v) => onChange(mode, f.key, v)}
                  />
                ) : (
                  <NumberConfigField
                    key={f.key}
                    label={f.label}
                    tooltip={f.tooltip}
                    unit={f.unit}
                    value={Number(profile[f.key])}
                    defaultValue={Number(f.defaults[mode])}
                    min={f.min!}
                    max={f.max!}
                    step={f.step!}
                    onChange={(v) => onChange(mode, f.key, v)}
                  />
                )
              )}
            </div>
          </SectionCard>
        );
      })}
    </>
  );
}

function GoalsTab({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]) => void;
}) {
  const min = generalField("goalMultiplierMin");
  const max = generalField("goalMultiplierMax");
  return (
    <SectionCard title="Configuração das metas" description="Limites do multiplicador-alvo e tipos de meta permitidos">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberConfigField
          label={min.label}
          tooltip={min.tooltip}
          value={form.general.goalMultiplierMin}
          defaultValue={min.default}
          min={min.min}
          max={min.max}
          step={min.step}
          onChange={(v) => onChange("goalMultiplierMin", v)}
        />
        <NumberConfigField
          label={max.label}
          tooltip={max.tooltip}
          value={form.general.goalMultiplierMax}
          defaultValue={max.default}
          min={max.min}
          max={max.max}
          step={max.step}
          onChange={(v) => onChange("goalMultiplierMax", v)}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <BooleanConfigField
          label="Permitir metas fixas"
          tooltip="A meta de cada partida usa sempre o multiplicador padrão configurado em Geral."
          value={form.general.goalAllowFixed}
          defaultValue={true}
          onChange={(v) => onChange("goalAllowFixed", v)}
        />
        <BooleanConfigField
          label="Permitir metas dinâmicas"
          tooltip="A meta pode variar entre o multiplicador mínimo e máximo configurados acima."
          value={form.general.goalAllowDynamic}
          defaultValue={false}
          onChange={(v) => onChange("goalAllowDynamic", v)}
        />
      </div>
    </SectionCard>
  );
}

function AntiCheatTab({
  antiCheat,
  onChange,
}: {
  antiCheat: AntiCheatConfig;
  onChange: (key: AntiCheatFieldKey, value: number) => void;
}) {
  return (
    <SectionCard
      title="Anti-Cheat"
      description="Limiares heurísticos aplicados no servidor a cada resgate/derrota — violar qualquer um cancela a partida, bloqueia o saque, registra log/auditoria e gera alerta para a equipe. Não há (nem é tecnicamente possível) detecção 100% confiável de manipulação de FPS/memória a partir do navegador — a proteção real vive aqui, no backend."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {ANTI_CHEAT_FIELDS.map((f) => {
          const field = antiCheatField(f.key);
          return (
            <NumberConfigField
              key={f.key}
              label={field.label}
              tooltip={field.tooltip}
              unit={field.unit}
              value={antiCheat[f.key]}
              defaultValue={field.default}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={(v) => onChange(f.key, v)}
            />
          );
        })}
      </div>
    </SectionCard>
  );
}

function VersionsTab({
  versions,
  loading,
  error,
  onRetry,
  onRestore,
}: {
  versions: GameEconomyConfigVersionSummaryDto[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onRestore: (versionId: string) => void;
}) {
  const columns: TableColumn<GameEconomyConfigVersionSummaryDto>[] = [
    { key: "version", header: "Versão", render: (v) => <span className="font-bold">v{v.version}</span> },
    {
      key: "status",
      header: "Status",
      render: (v) => (
        <StatusBadge tone={v.status === "ACTIVE" ? "success" : v.status === "DRAFT" ? "warning" : "neutral"}>
          {v.status}
        </StatusBadge>
      ),
    },
    {
      key: "description",
      header: "Descrição",
      render: (v) => <span className="text-xs text-text-secondary">{v.description ?? "—"}</span>,
    },
    {
      key: "preset",
      header: "Baseado no preset",
      render: (v) => (
        <div className="flex flex-col gap-0.5 text-[11px] text-text-muted">
          {MODE_LABEL_PAIRS.map(([mode, label]) => (
            <span key={mode}>
              {label}: <span className="font-semibold text-text-secondary">{presetLabel(v.modes[mode])}</span>
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Criado em",
      render: (v) => <span className="text-xs text-text-muted">{new Date(v.createdAt).toLocaleString("pt-BR")}</span>,
    },
    {
      key: "activatedAt",
      header: "Ativado em",
      render: (v) => (
        <span className="text-xs text-text-muted">
          {v.activatedAt ? new Date(v.activatedAt).toLocaleString("pt-BR") : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (v) =>
        v.status !== "ACTIVE" ? (
          <Button variant="secondary" size="sm" onClick={() => onRestore(v.id)}>
            <RotateCcw className="size-3.5" /> Restaurar
          </Button>
        ) : null,
    },
  ];

  return (
    <SectionCard title="Histórico de versões" description="Toda alteração vira uma nova versão — nada é sobrescrito ou apagado">
      <DataTable columns={columns} rows={versions} loading={loading} error={error} onRetry={onRetry} pageSize={10} emptyMessage="Nenhuma versão ainda" />
    </SectionCard>
  );
}
