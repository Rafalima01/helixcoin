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
 * DIFICULDADE V2 — the three modes now sit on three clearly separated rungs
 * of the same ladder the presets below describe (DEMO == "easy", NORMAL ==
 * "normal", HARD == "hard"), so what the admin picks in the panel and what a
 * player actually gets are the same thing.
 *
 * The previous pass moved gravity/ballSpeed/maxDangerSegments but left the
 * two levers that dominate perceived difficulty identical across NORMAL and
 * HARD: `gapWidth` (2 for every mode) and the danger ramp (always opened at
 * 1 red no matter the mode's ceiling). The result was three modes that felt
 * the same for their whole opening stretch. What changed here:
 *
 *  - `gapWidth`/`segmentsPerPlatform` now form a real angular ladder —
 *    90 deg (DEMO) -> 60 deg (NORMAL) -> 45 deg (HARD). The opening is the
 *    single most legible difficulty signal on screen, and it was flat.
 *  - The danger ramp opens at ~60% of the mode's own ceiling instead of
 *    always at 1, so a mode's `maxDangerSegments` is visible on its first
 *    unprotected platform (see generator.ts's dangerBudget).
 *  - Gravity climbs hard at the top (-17.5 -> -26) while the bounce ratio
 *    drops (0.56 -> 0.46): the ball cycles a platform in 0.83s on NORMAL vs
 *    0.64s on HARD, where before it was 0.83s vs 0.74s — a difference too
 *    small to feel.
 *
 * DEMO stays the gentlest of the three on purpose: it's the onboarding /
 * no-login trial mode (and the physics profile Contas Demo inherit via
 * `tags: ["demo"]` — see src/modules/demo-accounts), where being welcoming
 * and shareable is the point.
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
    tooltip:
      "Aceleração da queda. Mais negativo = a bola ganha velocidade mais rápido e o jogador tem menos tempo para girar a torre até a abertura. NÃO altera a altura do quique: a altura é alvo fixo e a velocidade de lançamento é resolvida por v = √(2·g·h), então mexer aqui muda só o ritmo, não o alcance do pulo. Mais negativo = mais difícil = RTP real menor.",
    kind: "number",
    unit: "m/s²",
    min: -40,
    max: -2,
    step: 0.5,
    defaults: { DEMO: -13, NORMAL: -17.5, HARD: -26 },
  },
  {
    key: "bounceForce",
    section: "physics",
    label: "Altura do quique",
    tooltip:
      "Altura que a bola sobe após bater, como fração do espaçamento entre plataformas (0,56 ≈ metade de um andar). É altura-alvo: todo quique sobe igual, independente da força do impacto. Mais alto = mais tempo no ar para posicionar a torre = mais fácil = RTP real maior.",
    kind: "number",
    min: 0.1,
    max: 1,
    step: 0.01,
    defaults: { DEMO: 0.66, NORMAL: 0.56, HARD: 0.46 },
  },
  {
    key: "ballSpeed",
    section: "physics",
    label: "Velocidade da bola",
    tooltip:
      "TETO de velocidade de queda (não a velocidade constante): a bola acelera pela gravidade até esbarrar neste limite. É a garantia de que o jogador sempre consegue reagir — por isso subir muito este número é o jeito mais rápido de deixar o jogo injusto. Maior = mais difícil = RTP real menor.",
    kind: "number",
    unit: "u/s",
    min: 4,
    max: 30,
    step: 0.5,
    defaults: { DEMO: 13, NORMAL: 16.5, HARD: 18.5 },
  },
  {
    key: "rotationSpeed",
    section: "physics",
    label: "Velocidade de rotação da torre",
    tooltip:
      "Multiplicador sobre a resposta da torre ao arrasto: 1 = padrão (o mesmo de sempre). Afeta tanto quanto a torre gira por um dado movimento de arrasto quanto o teto de velocidade do giro por inércia (fling) após soltar — nunca por frame, sempre por tempo real decorrido, então não varia com o FPS do aparelho. Maior = torre responde mais rápido = mais difícil de mirar a abertura = RTP real menor.",
    kind: "number",
    min: 0.5,
    max: 2,
    step: 0.05,
    defaults: { DEMO: 0.95, NORMAL: 1, HARD: 1.1 },
  },
  // ---- Estrutura das plataformas ----
  {
    key: "dangerChance",
    section: "generation",
    label: "Chance de segmentos vermelhos",
    tooltip:
      "Fração das plataformas que recebem QUALQUER segmento vermelho (0 a 1). É uma chave liga/desliga por plataforma: sorteada como não-perigosa, a plataforma fica 100% limpa; sorteada como perigosa, a quantidade de vermelhos vem do campo abaixo. Em 1 (padrão de NORMAL/HARD) toda plataforma depois das protegidas entra na conta. Maior = mais difícil = RTP real menor.",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    defaults: { DEMO: 0.45, NORMAL: 0.85, HARD: 1 },
  },
  {
    key: "maxDangerSegments",
    section: "generation",
    label: "Quantidade máxima de segmentos vermelhos por plataforma",
    tooltip:
      "TETO de vermelhos por plataforma. A primeira plataforma desprotegida já abre com ~60% deste teto (teto 7 → 4 vermelhos), e sobe +1 a cada 4 plataformas até bater no teto. Ou seja: este campo é sentido desde o começo, não só no fim da partida. Os segmentos ao lado da abertura nunca ficam vermelhos, então sempre existe rota. Maior = mais difícil = RTP real menor.",
    kind: "number",
    min: 0,
    max: 8,
    step: 1,
    defaults: { DEMO: 2, NORMAL: 4, HARD: 7 },
  },
  {
    key: "protectedPlatforms",
    section: "generation",
    label: "Quantidade de plataformas protegidas no início",
    tooltip:
      "Primeiras N plataformas 100% sem vermelhos. É o marco zero de TODA a curva de dificuldade: a rampa de vermelhos e a entrada das plataformas especiais (gelo, frágil, giratória, piscante) são contadas a partir daqui. 0 = perigo já na primeira plataforma. Maior = mais fácil = RTP real maior.",
    kind: "number",
    min: 0,
    max: 20,
    step: 1,
    defaults: { DEMO: 8, NORMAL: 4, HARD: 2 },
  },
  {
    key: "totalPlatforms",
    section: "generation",
    label: "Quantidade total de plataformas",
    tooltip:
      "Quantas plataformas são geradas no PRIMEIRO lote da torre. Não é o fim da partida: quando o jogador se aproxima do fim do lote, a torre é estendida em blocos de 30 indefinidamente. Ou seja, este campo é um ajuste de carregamento inicial — praticamente não muda a dificuldade nem o RTP. Só mexa se a torre estiver demorando a aparecer no primeiro frame.",
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
    tooltip:
      "Em quantas fatias o anel é dividido (12 = fatias de 30°). Como a abertura é medida em SEGMENTOS, este campo muda a largura real do buraco em graus: com abertura de 2, subir de 12 para 16 segmentos estreita a passagem de 60° para 45°. Sempre ajuste os dois juntos. Maior = mais difícil = RTP real menor.",
    kind: "number",
    min: 4,
    max: 24,
    step: 1,
    defaults: { DEMO: 12, NORMAL: 12, HARD: 16 },
  },
  {
    key: "gapWidth",
    section: "generation",
    label: "Largura da abertura entre segmentos",
    tooltip:
      "Quantos segmentos formam a passagem livre por onde a bola desce. O tamanho REAL depende do campo acima: 2 de 12 = 60°, mas 2 de 16 = 45°. Em 1 de 12 (30°) a passagem ainda tem 2,3x o diâmetro da bola — apertado, nunca impossível. É a única rota garantida de cada plataforma, e os segmentos vizinhos a ela nunca ficam vermelhos. Maior = mais fácil = RTP real maior.",
    kind: "number",
    min: 1,
    max: 6,
    step: 1,
    defaults: { DEMO: 3, NORMAL: 2, HARD: 2 },
  },
];

/**
 * Coherent starting points for the mode editors — never random, each one a
 * deliberately tuned bundle. Admin can still fine-tune any field afterward.
 *
 * `segmentsPerPlatform` belongs in the bundle because the opening is measured
 * in SEGMENTS, not degrees: the real angular gap is
 * `gapWidth x (360 / segmentsPerPlatform)`. With segments pinned at 12 for
 * every preset, `gapWidth` could only ever express 30-degree steps, which is
 * why the middle of the ladder used to collapse (normal/hard/very_hard all
 * sat at 2 segments = 60 degrees, i.e. an identical opening across the whole
 * top half of the range). Tuning the pair together is what makes a strictly
 * decreasing 120/90/60/45/30-degree ladder possible.
 */
export interface DifficultyPreset {
  key: string;
  label: string;
  description: string;
  values: {
    gravity: number;
    bounceForce: number;
    ballSpeed: number;
    rotationSpeed: number;
    dangerChance: number;
    maxDangerSegments: number;
    protectedPlatforms: number;
    segmentsPerPlatform: number;
    gapWidth: number;
  };
}

export const DIFFICULTY_PRESETS: DifficultyPreset[] = [
  {
    key: "very_easy",
    label: "Muito Fácil",
    description:
      "Abertura de 120° (10x o diâmetro da bola), no máximo 1 vermelho por plataforma e 12 plataformas protegidas. ~1,18s por plataforma — muito tempo para reagir.",
    values: {
      gravity: -10,
      bounceForce: 0.72,
      ballSpeed: 11,
      rotationSpeed: 0.85,
      dangerChance: 0.15,
      maxDangerSegments: 1,
      protectedPlatforms: 12,
      segmentsPerPlatform: 12,
      gapWidth: 4,
    },
  },
  {
    key: "easy",
    label: "Fácil",
    description:
      "Abertura de 90°, até 2 vermelhos e 8 plataformas protegidas. ~1,01s por plataforma. Perfil de onboarding — é o que o modo Demo usa.",
    values: {
      gravity: -13,
      bounceForce: 0.66,
      ballSpeed: 13,
      rotationSpeed: 0.95,
      dangerChance: 0.45,
      maxDangerSegments: 2,
      protectedPlatforms: 8,
      segmentsPerPlatform: 12,
      gapWidth: 3,
    },
  },
  {
    key: "normal",
    label: "Normal",
    description:
      "Abertura de 60°, até 4 vermelhos (2 já na primeira plataforma desprotegida) e 4 protegidas. ~0,83s por plataforma. O padrão da plataforma.",
    values: {
      gravity: -17.5,
      bounceForce: 0.56,
      ballSpeed: 16.5,
      rotationSpeed: 1,
      dangerChance: 0.85,
      maxDangerSegments: 4,
      protectedPlatforms: 4,
      segmentsPerPlatform: 12,
      gapWidth: 2,
    },
  },
  {
    key: "hard",
    label: "Difícil",
    description:
      "Abertura de 45° (16 segmentos, não 12), até 7 vermelhos começando em 4, só 2 protegidas. ~0,64s por plataforma — 23% menos tempo de reação que o Normal.",
    values: {
      gravity: -26,
      bounceForce: 0.46,
      ballSpeed: 18.5,
      rotationSpeed: 1.1,
      dangerChance: 1,
      maxDangerSegments: 7,
      protectedPlatforms: 2,
      segmentsPerPlatform: 16,
      gapWidth: 2,
    },
  },
  {
    key: "extreme",
    label: "Extremo",
    description:
      "Abertura de 30° — 1 bloco, 2,3x o diâmetro da bola. Zero plataformas protegidas: 4 vermelhos já na primeira. ~0,52s por plataforma. Margem de erro mínima, ainda sempre vencível.",
    values: {
      gravity: -36,
      bounceForce: 0.38,
      ballSpeed: 20,
      rotationSpeed: 1.2,
      dangerChance: 1,
      maxDangerSegments: 7,
      protectedPlatforms: 0,
      segmentsPerPlatform: 12,
      gapWidth: 1,
    },
  },
];

/**
 * `goalMultiplierMin`/`goalMultiplierMax` (and the "Metas" tab that edited
 * them, alongside `goalAllowFixed`/`goalAllowDynamic`) were removed from the
 * admin panel for the same reason as the two anti-cheat fields below: they
 * were inert. Dynamic goals were never implemented — MatchEngineService.start
 * sets `targetMultiplier = general.targetMultiplierDefault` unconditionally,
 * with no branch on the "allow" flags and no clamp to the min/max pair. Four
 * controls that saved, versioned and audited cleanly while changing nothing
 * about any match.
 *
 * The fields stay on GeneralConfig and in each match's `goalSnapshot`: old
 * config versions and old matches carry real values for them, and dropping
 * the keys would rewrite that history. They're just no longer editable —
 * `buildDefaultGeneral` pins them to fixed constants.
 */
export type GeneralFieldKey =
  | "targetMultiplierDefault"
  | "betMin"
  | "betMax"
  | "hardModeBalanceThreshold";

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
    tooltip:
      "Meta de TODA partida = valor apostado × este número (aposta de R$10 com multiplicador 5 → meta de R$50). O jogador só pode resgatar depois de atingir a meta, então este é o campo que mais mexe no RTP real de todos: maior = jogador precisa descer mais plataformas antes de poder sacar = menos partidas resgatadas = RTP real menor.",
    min: 1.1,
    max: 100,
    step: 0.1,
    default: 5,
  },
  {
    key: "betMin",
    label: "Aposta mínima",
    tooltip:
      "Piso da aposta, validado no servidor ao iniciar a partida (abaixo disso o /start é recusado). Não afeta dificuldade nem RTP — é limite comercial.",
    unit: "centavos",
    min: 100,
    max: 1_000_000,
    step: 100,
    default: 100, // R$1,00 — matches current betSchema
  },
  {
    key: "betMax",
    label: "Aposta máxima",
    tooltip:
      "Teto da aposta, validado no servidor ao iniciar a partida. Não afeta dificuldade nem RTP, mas limita a exposição máxima da casa em uma única partida.",
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
      "A partir deste Saldo Total (saldo atual + tudo que o jogador já sacou), as partidas dele passam a usar o perfil HARD em vez do NORMAL. É verificado a cada início de partida, então o jogador pode entrar e sair do Hard conforme o saldo varia. 0 desativa: todo mundo fica no NORMAL. Contas Demo ignoram esta regra (sempre DEMO). Menor = mais jogadores no perfil difícil = RTP real menor.",
    unit: "centavos",
    min: 0,
    max: 100_000_000,
    step: 100,
    default: 0, // disabled by default — everyone stays NORMAL until an admin sets a real threshold
  },
];

/** Fixed values for the two goal bounds that are no longer admin-editable — see the GeneralFieldKey note above. */
export const GOAL_MULTIPLIER_MIN = 1.2;
export const GOAL_MULTIPLIER_MAX = 50;

/**
 * `maxHorizontalSpeed` and `maxAcceleration` were removed rather than wired
 * up. Both would have to be measured client-side and self-reported, and a
 * self-reported bound is precisely what a cheating client falsifies first —
 * shipping them as sliders would have been security theatre: a control that
 * only reassures whoever trusts it. Everything left here is enforced from
 * values the server measures or derives itself.
 */
export type AntiCheatFieldKey =
  | "maxPlatformsPerSecond"
  | "minSecondsToGoal"
  | "minSecondsBeforeCashout"
  | "maxVerticalSpeed"
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
    tooltip:
      "Ritmo máximo plausível de descida, medido pelo relógio do servidor (plataformas ÷ tempo). Roda em duas frentes: a média da partida inteira e, com 50% de folga para jitter de rede, o intervalo desde o último checkpoint — é o segundo que pega o script que espera o cronômetro e depois reporta um salto. Acima do teto, o resolve é RECUSADO e a partida é sinalizada. Baixar aperta a detecção e aumenta o risco de falso positivo com jogador rápido em conexão ruim.",
    unit: "plataformas/s",
    min: 0.5,
    max: 10,
    step: 0.1,
    default: 3,
  },
  {
    key: "minSecondsToGoal",
    label: "Tempo mínimo permitido para atingir a meta",
    tooltip:
      "Piso de tempo real entre o /start e um resgate. Vale só no resgate — derrota e desistência nunca são barradas por tempo. Resgatar antes disso é recusado e sinalizado. Suba com cuidado: um teto alto demais barra o jogador legítimo que atingiu a meta rápido com uma aposta de multiplicador baixo.",
    unit: "s",
    min: 1,
    max: 60,
    step: 1,
    default: 5,
  },
  {
    key: "minSecondsBeforeCashout",
    label: "Tempo mínimo para resgate",
    tooltip:
      "Segundo piso de tempo para o resgate, aplicado junto com o de cima — na prática vale o MAIOR dos dois. Existe separado para permitir uma regra frouxa de meta e ainda assim bloquear o resgate instantâneo por replay de requisição. 0 desativa este piso (o de cima continua valendo).",
    unit: "s",
    min: 0,
    max: 30,
    step: 1,
    default: 2,
  },
  {
    key: "maxVerticalSpeed",
    label: "Máxima velocidade vertical",
    tooltip:
      "Teto de velocidade de queda aceita no resolve. ATENÇÃO — diferente dos outros campos desta aba, este valor vem do cliente: pega cliente ingênuo (velocidade adulterada sem esconder o relatório), mas um bot que simplesmente não envia o campo passa por ele, porque campo ausente pula a checagem. Não substitui o teto de plataformas/segundo, que é medido pelo servidor. Deixe acima da velocidade máxima real do modo mais rápido (hoje o campo 'Velocidade da bola' do HARD) para não recusar partida honesta.",
    unit: "u/s",
    min: 5,
    max: 100,
    step: 1,
    default: 30,
  },
  {
    key: "maxCollisionsPerSecond",
    label: "Máximo número de colisões por segundo",
    tooltip:
      "Teto de colisões por segundo. A taxa é CALCULADA no servidor (total de colisões ÷ tempo decorrido medido pelo servidor), nunca enviada pelo cliente — acima do teto, o resolve é recusado e a partida é sinalizada. Pega auto-click/bot; baixar o valor aperta a detecção e aumenta o risco de falso positivo.",
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
