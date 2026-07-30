import type { GameMode } from "@prisma/client";

/**
 * Single source of truth for every admin-configurable gameplay knob.
 *
 * This registry drives THREE things at once (see this module's README):
 *   1. The Zod schema used to validate a draft config (validators/).
 *   2. The admin UI (components/admin/config-field.tsx iterates this list
 *      instead of hand-written JSX form rows).
 *   3. The seed defaults for the very first GameEconomyConfig version.
 *
 * Deliberately small by design: the panel exposes only the handful of knobs
 * that actually change perceived difficulty (gravity, bounce, ball speed,
 * red-segment odds/severity, protected platforms, platform/segment count,
 * opening width). Everything else that used to be here (ball weight,
 * collision radius/precision, elasticity, friction, rotation min/max, drag
 * sensitivity, min/max speed as a pair, camera distance/height/FOV/speed,
 * collision cooldown, bonus/special-platform chance, gap chance, random
 * distribution, ...) is intentionally NOT admin-configurable — those stay
 * fixed engine constants in src/game-engine/config.ts. An admin panel with
 * 35 raw physics sliders isn't more powerful, it's just harder to use
 * without breaking game feel by accident.
 *
 * `MODE_FIELDS` are duplicated per GameMode (DEMO/NORMAL/HARD) — the same
 * knobs, tuned three times (dangerChance: 1 means "the depth-scaled danger
 * budget always applies, exactly like before this was configurable").
 *
 * NORMAL/HARD were recalibrated (RTP11) after player feedback that the game
 * felt too easy — players advanced too many platforms too often even with
 * dangerChance already maxed out. The fix isn't a lower payout, it's a
 * harder climb: faster gravity/ball speed (less reaction time), a lower
 * bounce (less hang time to plan the next move), and — the main lever — a
 * higher `maxDangerSegments` ceiling reached sooner (see generator.ts's
 * `dangerBudget`, whose ramp-rate divisor dropped from 9 to 6 rings per step
 * as part of this same pass). DEMO is untouched on purpose: it's the
 * onboarding/no-login trial mode (and the physics profile Contas Demo also
 * inherit via `tags: ["demo"]` — see src/modules/demo-accounts), where
 * staying easy and shareable is the point, not a bug.
 */

export type FieldSection = "physics" | "generation";
export type FieldKind = "number" | "boolean";

export interface ModeFieldDef {
  key: string;
  section: FieldSection;
  label: string;
  tooltip: string;
  kind: FieldKind;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  defaults: Record<GameMode, number | boolean>;
}

export const MODE_FIELDS: ModeFieldDef[] = [
  // ---- Física da bola ----
  {
    key: "gravity",
    section: "physics",
    label: "Gravidade da bola",
    tooltip: "Controla se a bola cai mais rápido (número mais negativo) ou mais devagar.",
    kind: "number",
    unit: "m/s²",
    min: -40,
    max: -2,
    step: 0.5,
    defaults: { DEMO: -15, NORMAL: -17.5, HARD: -21 },
  },
  {
    key: "bounceForce",
    section: "physics",
    label: "Altura do quique",
    tooltip: "Baixo, médio ou alto — quanto a bola sobe depois de bater em uma plataforma.",
    kind: "number",
    min: 0.1,
    max: 1,
    step: 0.01,
    defaults: { DEMO: 0.62, NORMAL: 0.56, HARD: 0.52 },
  },
  {
    key: "ballSpeed",
    section: "physics",
    label: "Velocidade da bola",
    tooltip: "Velocidade de queda da bola — mais lenta ou mais rápida.",
    kind: "number",
    unit: "u/s",
    min: 4,
    max: 30,
    step: 0.5,
    defaults: { DEMO: 14.5, NORMAL: 16.5, HARD: 19 },
  },
  // ---- Estrutura das plataformas ----
  {
    key: "dangerChance",
    section: "generation",
    label: "Chance de segmentos vermelhos",
    tooltip: "Probabilidade (0-1) de uma plataforma receber segmentos perigosos.",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    defaults: { DEMO: 0.85, NORMAL: 1, HARD: 1 },
  },
  {
    key: "maxDangerSegments",
    section: "generation",
    label: "Quantidade máxima de segmentos vermelhos por plataforma",
    tooltip: "Teto de segmentos perigosos que uma única plataforma pode ter.",
    kind: "number",
    min: 0,
    max: 8,
    step: 1,
    defaults: { DEMO: 3, NORMAL: 4, HARD: 5 },
  },
  {
    key: "protectedPlatforms",
    section: "generation",
    label: "Quantidade de plataformas protegidas no início",
    tooltip: "Primeiras plataformas geradas sem nenhum obstáculo, para o jogador se ambientar.",
    kind: "number",
    min: 0,
    max: 20,
    step: 1,
    defaults: { DEMO: 5, NORMAL: 4, HARD: 2 },
  },
  {
    key: "totalPlatforms",
    section: "generation",
    label: "Quantidade total de plataformas",
    tooltip: "Número de plataformas geradas na partida.",
    kind: "number",
    min: 10,
    max: 200,
    step: 1,
    defaults: { DEMO: 44, NORMAL: 44, HARD: 44 },
  },
  {
    key: "segmentsPerPlatform",
    section: "generation",
    label: "Quantidade de segmentos por plataforma",
    tooltip: "Em quantas partes cada plataforma é dividida.",
    kind: "number",
    min: 4,
    max: 24,
    step: 1,
    defaults: { DEMO: 12, NORMAL: 12, HARD: 12 },
  },
  {
    key: "gapWidth",
    section: "generation",
    label: "Largura da abertura entre segmentos",
    tooltip: "Quão larga é a passagem livre em cada plataforma.",
    kind: "number",
    min: 1,
    max: 6,
    step: 1,
    defaults: { DEMO: 2, NORMAL: 2, HARD: 2 },
  },
];

/** Coherent starting points for the mode editors — never random, each one a deliberately tuned bundle. Admin can still fine-tune any field afterward. */
export interface DifficultyPreset {
  key: string;
  label: string;
  description: string;
  values: {
    gravity: number;
    bounceForce: number;
    ballSpeed: number;
    dangerChance: number;
    maxDangerSegments: number;
    protectedPlatforms: number;
    gapWidth: number;
  };
}

export const DIFFICULTY_PRESETS: DifficultyPreset[] = [
  {
    key: "very_easy",
    label: "Muito Fácil",
    description: "Poucos segmentos vermelhos, aberturas largas, gravidade leve — o jogador aprende rápido e sente facilidade para ganhar.",
    values: {
      gravity: -10,
      bounceForce: 0.72,
      ballSpeed: 11,
      dangerChance: 0.12,
      maxDangerSegments: 1,
      protectedPlatforms: 12,
      gapWidth: 4,
    },
  },
  {
    key: "easy",
    label: "Fácil",
    description: "Ainda favorece o jogador — poucos segmentos vermelhos e boa quantidade de aberturas, com ganhos frequentes.",
    values: {
      gravity: -12,
      bounceForce: 0.68,
      ballSpeed: 12.5,
      dangerChance: 0.25,
      maxDangerSegments: 2,
      protectedPlatforms: 8,
      gapWidth: 3,
    },
  },
  {
    key: "normal",
    label: "Normal",
    description: "Dificuldade equilibrada — o padrão da plataforma (recalibrado: exige mais atenção do jogador do que antes, sem deixar de ser justo).",
    values: {
      gravity: -17.5,
      bounceForce: 0.56,
      ballSpeed: 16.5,
      dangerChance: 1,
      maxDangerSegments: 4,
      protectedPlatforms: 4,
      gapWidth: 2,
    },
  },
  {
    key: "hard",
    label: "Difícil",
    description: "Mais segmentos vermelhos, gravidade mais intensa e menos plataformas protegidas — exige mais habilidade.",
    values: {
      gravity: -21,
      bounceForce: 0.52,
      ballSpeed: 19,
      dangerChance: 1,
      maxDangerSegments: 5,
      protectedPlatforms: 2,
      gapWidth: 2,
    },
  },
  {
    key: "very_hard",
    label: "Muito Difícil",
    description: "Para usar em situações específicas — mais obstáculos e gravidade mais intensa, mas ainda um jogo justo e vencível.",
    values: {
      gravity: -23,
      bounceForce: 0.48,
      ballSpeed: 20.5,
      dangerChance: 1,
      maxDangerSegments: 6,
      protectedPlatforms: 2,
      gapWidth: 2,
    },
  },
];

export type GeneralFieldKey =
  | "targetMultiplierDefault"
  | "betMin"
  | "betMax"
  | "hardModeBalanceThreshold"
  | "goalMultiplierMin"
  | "goalMultiplierMax";

export interface GeneralFieldDef {
  key: GeneralFieldKey;
  label: string;
  tooltip: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/**
 * `betMin`/`betMax`/`hardModeBalanceThreshold` are stored and edited in
 * cents (matches the schema-wide money convention), even though the admin
 * UI displays/accepts reais.
 */
export const GENERAL_FIELDS: GeneralFieldDef[] = [
  {
    key: "targetMultiplierDefault",
    label: "Multiplicador padrão da meta",
    tooltip: "Meta = Valor Apostado × este multiplicador, quando a meta fixa está em uso.",
    min: 1.1,
    max: 100,
    step: 0.1,
    default: 5,
  },
  {
    key: "betMin",
    label: "Aposta mínima",
    tooltip: "Valor mínimo de aposta aceito ao iniciar uma partida.",
    unit: "centavos",
    min: 100,
    max: 1_000_000,
    step: 100,
    default: 100, // R$1,00 — matches current betSchema
  },
  {
    key: "betMax",
    label: "Aposta máxima",
    tooltip: "Valor máximo de aposta aceito ao iniciar uma partida.",
    unit: "centavos",
    min: 100,
    max: 10_000_000,
    step: 100,
    default: 2_000_000, // R$20.000,00 — matches current betSchema
  },
  {
    key: "hardModeBalanceThreshold",
    label: "Limite de saldo para ativar Modo Hard",
    tooltip:
      "Saldo Total (saldo atual + total já sacado) a partir do qual o jogador entra automaticamente em Modo Hard. 0 desativa o recurso.",
    unit: "centavos",
    min: 0,
    max: 100_000_000,
    step: 100,
    default: 0, // disabled by default — everyone stays NORMAL until an admin sets a real threshold
  },
  {
    key: "goalMultiplierMin",
    label: "Multiplicador mínimo da meta",
    tooltip: "Piso permitido para a meta de uma partida, quando metas dinâmicas estão habilitadas.",
    min: 1.05,
    max: 100,
    step: 0.05,
    default: 1.2,
  },
  {
    key: "goalMultiplierMax",
    label: "Multiplicador máximo da meta",
    tooltip: "Teto permitido para a meta de uma partida, quando metas dinâmicas estão habilitadas.",
    min: 1.1,
    max: 200,
    step: 0.5,
    default: 50,
  },
];

export type AntiCheatFieldKey =
  | "maxPlatformsPerSecond"
  | "minSecondsToGoal"
  | "minSecondsBeforeCashout"
  | "maxVerticalSpeed"
  | "maxHorizontalSpeed"
  | "maxAcceleration"
  | "maxCollisionsPerSecond";

export interface AntiCheatFieldDef {
  key: AntiCheatFieldKey;
  label: string;
  tooltip: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export const ANTI_CHEAT_FIELDS: AntiCheatFieldDef[] = [
  {
    key: "maxPlatformsPerSecond",
    label: "Máximo de plataformas por segundo",
    tooltip: "Ritmo máximo plausível de progresso — acima disso o resolve é recusado e a partida é sinalizada.",
    unit: "plataformas/s",
    min: 0.5,
    max: 10,
    step: 0.1,
    default: 3,
  },
  {
    key: "minSecondsToGoal",
    label: "Tempo mínimo permitido para atingir a meta",
    tooltip: "Tempo mínimo, em segundos, entre o início da partida e o alcance da meta.",
    unit: "s",
    min: 1,
    max: 60,
    step: 1,
    default: 5,
  },
  {
    key: "minSecondsBeforeCashout",
    label: "Tempo mínimo para resgate",
    tooltip: "Tempo mínimo, em segundos, entre o início da partida e um resgate (cashout).",
    unit: "s",
    min: 0,
    max: 30,
    step: 1,
    default: 2,
  },
  {
    key: "maxVerticalSpeed",
    label: "Máxima velocidade vertical",
    tooltip: "Velocidade vertical reportada acima da qual a sessão é considerada suspeita.",
    unit: "u/s",
    min: 5,
    max: 100,
    step: 1,
    default: 30,
  },
  {
    key: "maxHorizontalSpeed",
    label: "Máxima velocidade horizontal",
    tooltip: "Velocidade angular/horizontal reportada acima da qual a sessão é considerada suspeita.",
    unit: "rad/s",
    min: 2,
    max: 50,
    step: 1,
    default: 15,
  },
  {
    key: "maxAcceleration",
    label: "Máxima aceleração",
    tooltip: "Variação de velocidade por segundo acima da qual a sessão é considerada suspeita.",
    unit: "u/s²",
    min: 5,
    max: 200,
    step: 1,
    default: 60,
  },
  {
    key: "maxCollisionsPerSecond",
    label: "Máximo número de colisões por segundo",
    tooltip: "Taxa de colisões reportada acima da qual a sessão é considerada suspeita (ex.: auto-click/bot).",
    unit: "colisões/s",
    min: 1,
    max: 30,
    step: 1,
    default: 8,
  },
];

export const GAME_MODES: GameMode[] = ["DEMO", "NORMAL", "HARD"];

/** Default cents amounts for the quick-bet button row — matches the current hardcoded R$5/10/20/50 UI. */
export const DEFAULT_QUICK_BET_AMOUNTS = [500, 1000, 2000, 5000];
