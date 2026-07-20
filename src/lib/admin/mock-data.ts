/**
 * Deterministic mock datasets for the Phase 1 backoffice.
 * Nothing here is business logic — it exists only to feed the screens until
 * the real backend replaces the service layer.
 */
import type {
  AdminAccountDTO,
  AdminUserRowDTO,
  AffiliateRowDTO,
  AlertDTO,
  ApiKeyDTO,
  AuditEntryDTO,
  FinanceSummaryDTO,
  GameRowDTO,
  GatewayDTO,
  IntegrationDTO,
  KpiDTO,
  LedgerEntryDTO,
  LogEntryDTO,
  NotificationCampaignDTO,
  PaymentRowDTO,
  PromotionDTO,
  QueueDTO,
  SecurityEventDTO,
  SeriesPointDTO,
  ServiceHealthDTO,
  InfraNodeDTO,
  WalletRowDTO,
} from "@/lib/admin/types";

/** Small deterministic PRNG so charts look organic but never change. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function series(seed: number, points: number, base: number, spread: number): number[] {
  const r = rng(seed);
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < points; i++) {
    v = Math.max(0, v + (r() - 0.46) * spread);
    out.push(Math.round(v));
  }
  return out;
}

export function labeledSeries(
  seed: number,
  labels: string[],
  base: number,
  spread: number
): SeriesPointDTO[] {
  const values = series(seed, labels.length, base, spread);
  return labels.map((label, i) => ({ label, value: values[i] }));
}

export const HOURS = [
  "00h",
  "02h",
  "04h",
  "06h",
  "08h",
  "10h",
  "12h",
  "14h",
  "16h",
  "18h",
  "20h",
  "22h",
];
export const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];

// ---------------------------------------------------------------- dashboard
export const dashboardKpis: KpiDTO[] = [
  {
    id: "online",
    label: "Usuários Online",
    value: "3.247",
    delta: "+12,4%",
    trend: "up",
    series: series(11, 16, 2800, 320),
  },
  {
    id: "signups",
    label: "Novos Cadastros (24h)",
    value: "1.082",
    delta: "+8,1%",
    trend: "up",
    series: series(12, 16, 900, 180),
  },
  {
    id: "ftd",
    label: "FTDs (24h)",
    value: "312",
    delta: "+4,9%",
    trend: "up",
    series: series(13, 16, 280, 60),
  },
  {
    id: "deposits",
    label: "Depósitos (24h)",
    value: "R$ 842.310",
    delta: "+15,2%",
    trend: "up",
    series: series(14, 16, 700, 220),
  },
  {
    id: "withdrawals",
    label: "Saques (24h)",
    value: "R$ 512.940",
    delta: "-3,4%",
    trend: "down",
    series: series(15, 16, 560, 160),
  },
  {
    id: "revenue",
    label: "Receita (GGR)",
    value: "R$ 329.370",
    delta: "+9,6%",
    trend: "up",
    series: series(16, 16, 300, 90),
  },
  {
    id: "profit",
    label: "Lucro Líquido",
    value: "R$ 204.118",
    delta: "+6,2%",
    trend: "up",
    series: series(17, 16, 190, 70),
  },
  {
    id: "rtp",
    label: "RTP Médio",
    value: "94,2%",
    delta: "-0,3 pp",
    trend: "flat",
    series: series(18, 16, 94, 2),
  },
  {
    id: "ticket",
    label: "Ticket Médio",
    value: "R$ 38,70",
    delta: "+1,8%",
    trend: "up",
    series: series(19, 16, 36, 6),
  },
  {
    id: "conversion",
    label: "Conversão",
    value: "28,8%",
    delta: "+2,1 pp",
    trend: "up",
    series: series(20, 16, 27, 4),
  },
  {
    id: "cpa",
    label: "CPA Pago (24h)",
    value: "R$ 18.450",
    delta: "+5,0%",
    trend: "up",
    series: series(21, 16, 17, 4),
  },
  {
    id: "revshare",
    label: "RevShare (24h)",
    value: "R$ 31.220",
    delta: "+3,7%",
    trend: "up",
    series: series(22, 16, 29, 6),
  },
];

export const dashboardAlerts: AlertDTO[] = [
  {
    id: "al1",
    title: "Gateway PixFast degradado",
    detail: "Taxa de sucesso caiu para 91,2% nos últimos 15 min.",
    severity: "warning",
    createdAt: "há 4 min",
  },
  {
    id: "al2",
    title: "Pico de saques detectado",
    detail: "Volume de saques 2,3x acima da média para o horário.",
    severity: "critical",
    createdAt: "há 12 min",
  },
  {
    id: "al3",
    title: "Fila de webhooks acumulando",
    detail: "1.240 jobs pendentes na fila payments.webhooks.",
    severity: "warning",
    createdAt: "há 25 min",
  },
  {
    id: "al4",
    title: "Novo recorde de usuários online",
    detail: "3.412 usuários simultâneos às 21h14.",
    severity: "info",
    createdAt: "há 1 h",
  },
];

export const recentEvents: AuditEntryDTO[] = [
  {
    id: "ev1",
    actor: "Rafael Lima",
    role: "owner",
    action: "Alterou meta global para 5.00x",
    target: "GameConfig",
    ip: "187.44.12.90",
    createdAt: "há 8 min",
    severity: "warning",
  },
  {
    id: "ev2",
    actor: "Sistema",
    role: "admin",
    action: "Bloqueio automático por multi-conta",
    target: "user_9f2k1",
    ip: "—",
    createdAt: "há 19 min",
    severity: "critical",
  },
  {
    id: "ev3",
    actor: "Carla Nunes",
    role: "finance",
    action: "Aprovou saque de R$ 4.800,00",
    target: "wd_88213",
    ip: "201.17.55.3",
    createdAt: "há 32 min",
    severity: "info",
  },
  {
    id: "ev4",
    actor: "Diego Prado",
    role: "support",
    action: "Reenviou e-mail de verificação",
    target: "user_1c9aa",
    ip: "177.92.10.41",
    createdAt: "há 40 min",
    severity: "info",
  },
  {
    id: "ev5",
    actor: "Carla Nunes",
    role: "finance",
    action: "Marcou depósito como suspeito",
    target: "dp_55102",
    ip: "201.17.55.3",
    createdAt: "há 1 h",
    severity: "warning",
  },
];

// ------------------------------------------------------------------- users
const USER_NAMES = [
  "Bruno Carvalho",
  "Marina Souza",
  "Felipe Ramos",
  "Julia Tavares",
  "Enzo Ferreira",
  "Rafaela Costa",
  "Pedro Antunes",
  "Bianca Rocha",
  "Lucas Moreira",
  "Amanda Dias",
  "Thiago Neves",
  "Camila Prado",
];

export const usersRows: AdminUserRowDTO[] = USER_NAMES.map((name, i) => {
  const r = rng(100 + i);
  const statuses: AdminUserRowDTO["status"][] = [
    "active",
    "active",
    "active",
    "review",
    "blocked",
    "pending",
  ];
  return {
    id: `usr_${(1000 + i * 37).toString(16)}`,
    name,
    email: `${name.split(" ")[0].toLowerCase()}.${name.split(" ")[1].toLowerCase()}@gmail.com`,
    status: statuses[Math.floor(r() * statuses.length)],
    balance: Math.round(r() * 250000) / 100,
    totalDeposited: Math.round(r() * 2500000) / 100,
    totalWithdrawn: Math.round(r() * 1800000) / 100,
    createdAt: `${String(1 + Math.floor(r() * 28)).padStart(2, "0")}/0${1 + Math.floor(r() * 7)}/2026`,
    lastSeenAt: i < 4 ? "agora" : `há ${1 + Math.floor(r() * 20)} h`,
    kycLevel: (["none", "basic", "full"] as const)[Math.floor(r() * 3)],
  };
});

export const adminAccounts: AdminAccountDTO[] = [
  {
    id: "adm_1",
    name: "Rafael Lima",
    email: "rafael@helijump.gg",
    role: "owner",
    twoFactor: true,
    lastLoginAt: "agora",
    status: "active",
  },
  {
    id: "adm_2",
    name: "Carla Nunes",
    email: "carla@helijump.gg",
    role: "finance",
    twoFactor: true,
    lastLoginAt: "há 12 min",
    status: "active",
  },
  {
    id: "adm_3",
    name: "Diego Prado",
    email: "diego@helijump.gg",
    role: "support",
    twoFactor: true,
    lastLoginAt: "há 1 h",
    status: "active",
  },
  {
    id: "adm_4",
    name: "Aline Barros",
    email: "aline@helijump.gg",
    role: "analyst",
    twoFactor: false,
    lastLoginAt: "há 3 d",
    status: "active",
  },
  {
    id: "adm_5",
    name: "Marcos Vidal",
    email: "marcos@helijump.gg",
    role: "admin",
    twoFactor: true,
    lastLoginAt: "há 6 d",
    status: "suspended",
  },
];

export const walletsRows: WalletRowDTO[] = usersRows.slice(0, 10).map((u, i) => {
  const r = rng(200 + i);
  return {
    id: `wal_${i + 1}`,
    userName: u.name,
    balance: u.balance,
    bonusBalance: Math.round(r() * 8000) / 100,
    lockedBalance: i % 4 === 0 ? Math.round(r() * 40000) / 100 : 0,
    updatedAt: `há ${1 + Math.floor(r() * 50)} min`,
    flagged: i % 5 === 3,
  };
});

const LEDGER_TYPES: LedgerEntryDTO["type"][] = [
  "deposit",
  "bet",
  "payout",
  "withdraw",
  "bonus",
  "commission",
  "cashback",
  "adjustment",
];
export const ledgerRows: LedgerEntryDTO[] = Array.from({ length: 12 }, (_, i) => {
  const r = rng(300 + i);
  const type = LEDGER_TYPES[i % LEDGER_TYPES.length];
  const sign = ["deposit", "payout", "bonus", "commission", "cashback"].includes(type) ? 1 : -1;
  const amount = (sign * Math.round((10 + r() * 900) * 100)) / 100;
  return {
    id: `led_${9000 - i}`,
    userName: USER_NAMES[i % USER_NAMES.length],
    type,
    amount,
    balanceAfter: Math.round(r() * 500000) / 100,
    reference: `${type.slice(0, 2)}_${(83100 - i * 7).toString(16)}`,
    createdAt: `19/07/2026 ${String(23 - i).padStart(2, "0")}:${String(59 - i * 3).padStart(2, "0")}`,
  };
});

// ---------------------------------------------------------------- payments
const GATEWAY_NAMES = ["PixFast", "PagLuz", "TurboPay"];
export function paymentRows(seed: number, kind: "deposit" | "withdraw"): PaymentRowDTO[] {
  return Array.from({ length: 10 }, (_, i) => {
    const r = rng(seed + i);
    const statuses: PaymentRowDTO["status"][] =
      kind === "deposit"
        ? ["completed", "completed", "completed", "pending", "failed"]
        : ["completed", "completed", "processing", "pending", "failed"];
    return {
      id: `${kind === "deposit" ? "dp" : "wd"}_${55100 - i * 3}`,
      userName: USER_NAMES[(i * 3 + seed) % USER_NAMES.length],
      method: "PIX",
      gateway: GATEWAY_NAMES[i % GATEWAY_NAMES.length],
      amount: Math.round((kind === "deposit" ? 20 : 50) + r() * 4000),
      status: statuses[Math.floor(r() * statuses.length)],
      createdAt: `19/07/2026 ${String(23 - i).padStart(2, "0")}:${String(50 - i * 4).padStart(2, "0")}`,
    };
  });
}

export const gateways: GatewayDTO[] = [
  {
    id: "gw_1",
    name: "PixFast",
    provider: "PixFast Pagamentos S.A.",
    status: "degraded",
    successRate: 91.2,
    avgLatencyMs: 840,
    volume24h: 412300,
    fee: "1,4% + R$0,10",
  },
  {
    id: "gw_2",
    name: "PagLuz",
    provider: "PagLuz Instituição de Pagamento",
    status: "online",
    successRate: 99.1,
    avgLatencyMs: 310,
    volume24h: 286500,
    fee: "1,9%",
  },
  {
    id: "gw_3",
    name: "TurboPay",
    provider: "TurboPay LTDA",
    status: "online",
    successRate: 98.4,
    avgLatencyMs: 420,
    volume24h: 143510,
    fee: "1,2% + R$0,25",
  },
  {
    id: "gw_4",
    name: "NitroBank",
    provider: "NitroBank S.A. (sandbox)",
    status: "offline",
    successRate: 0,
    avgLatencyMs: 0,
    volume24h: 0,
    fee: "—",
  },
];

export const affiliates: AffiliateRowDTO[] = [
  {
    id: "af_1",
    name: "Equipe Alfa Digital",
    code: "ALFA10",
    network: 1240,
    depositors: 411,
    volume: 231400,
    commission: 18512,
    cpa: 9200,
    revshare: 9312,
    status: "active",
  },
  {
    id: "af_2",
    name: "João Influencer",
    code: "JOAO123",
    network: 830,
    depositors: 265,
    volume: 149800,
    commission: 11984,
    cpa: 6100,
    revshare: 5884,
    status: "active",
  },
  {
    id: "af_3",
    name: "Rede Beta Traffic",
    code: "BETA77",
    network: 512,
    depositors: 122,
    volume: 88450,
    commission: 7076,
    cpa: 3400,
    revshare: 3676,
    status: "active",
  },
  {
    id: "af_4",
    name: "Promo Gamma",
    code: "GAMMA5",
    network: 190,
    depositors: 31,
    volume: 15200,
    commission: 1216,
    cpa: 700,
    revshare: 516,
    status: "paused",
  },
  {
    id: "af_5",
    name: "Canal Delta Play",
    code: "DELTA9",
    network: 88,
    depositors: 12,
    volume: 6100,
    commission: 488,
    cpa: 240,
    revshare: 248,
    status: "active",
  },
];

export const financeSummary: FinanceSummaryDTO = {
  ggr: 329370,
  ngr: 271204,
  deposits: 842310,
  withdrawals: 512940,
  bonusCost: 22140,
  gatewayFees: 14806,
  affiliateCost: 49670,
  netProfit: 204118,
};

// -------------------------------------------------------------------- game
export const games: GameRowDTO[] = [
  {
    id: "gm_1",
    name: "HeliJump Classic",
    provider: "HeliJump Studio",
    category: "Skill / Arcade",
    status: "enabled",
    sessions24h: 48210,
    ggr24h: 214300,
    featured: true,
  },
  {
    id: "gm_2",
    name: "HeliJump Turbo",
    provider: "HeliJump Studio",
    category: "Skill / Arcade",
    status: "enabled",
    sessions24h: 19340,
    ggr24h: 88120,
    featured: true,
  },
  {
    id: "gm_3",
    name: "HeliJump Duo (beta)",
    provider: "HeliJump Studio",
    category: "Skill / Multiplayer",
    status: "maintenance",
    sessions24h: 0,
    ggr24h: 0,
    featured: false,
  },
  {
    id: "gm_4",
    name: "Tower Rush",
    provider: "HeliJump Labs",
    category: "Skill / Arcade",
    status: "disabled",
    sessions24h: 0,
    ggr24h: 0,
    featured: false,
  },
];

export const promotions: PromotionDTO[] = [
  {
    id: "pr_1",
    name: "Bônus de Boas-vindas 100%",
    kind: "bonus",
    status: "active",
    startsAt: "01/07/2026",
    endsAt: "31/07/2026",
    budget: 50000,
    used: 31240,
  },
  {
    id: "pr_2",
    name: "Cashback Semanal 5%",
    kind: "cashback",
    status: "active",
    startsAt: "15/07/2026",
    endsAt: "22/07/2026",
    budget: 20000,
    used: 8420,
  },
  {
    id: "pr_3",
    name: "Missões de Julho",
    kind: "mission",
    status: "active",
    startsAt: "01/07/2026",
    endsAt: "31/07/2026",
    budget: 15000,
    used: 9100,
  },
  {
    id: "pr_4",
    name: "Temporada Neon — S2",
    kind: "season",
    status: "scheduled",
    startsAt: "01/08/2026",
    endsAt: "30/09/2026",
    budget: 120000,
    used: 0,
  },
  {
    id: "pr_5",
    name: "Torneio Relâmpago",
    kind: "tournament",
    status: "ended",
    startsAt: "05/07/2026",
    endsAt: "07/07/2026",
    budget: 10000,
    used: 10000,
  },
];

// -------------------------------------------------------------- operations
export const auditRows: AuditEntryDTO[] = [
  ...recentEvents,
  {
    id: "ev6",
    actor: "Rafael Lima",
    role: "owner",
    action: "Criou chave de API produção",
    target: "ak_live_71",
    ip: "187.44.12.90",
    createdAt: "há 2 h",
    severity: "warning",
  },
  {
    id: "ev7",
    actor: "Aline Barros",
    role: "analyst",
    action: "Exportou relatório financeiro",
    target: "rep_jul_19",
    ip: "45.171.8.22",
    createdAt: "há 3 h",
    severity: "info",
  },
  {
    id: "ev8",
    actor: "Sistema",
    role: "admin",
    action: "Rotação automática de segredos",
    target: "vault",
    ip: "—",
    createdAt: "há 6 h",
    severity: "info",
  },
];

export const logRows: LogEntryDTO[] = [
  {
    id: "lg_1",
    level: "error",
    service: "payments-api",
    message: "Webhook PixFast timeout após 10s (tx dp_55102)",
    createdAt: "23:58:12",
  },
  {
    id: "lg_2",
    level: "warn",
    service: "payments-api",
    message: "Retry 3/5 para confirmação de depósito dp_55102",
    createdAt: "23:58:04",
  },
  {
    id: "lg_3",
    level: "info",
    service: "game-engine",
    message: "Partida m_88iz resolvida: cashout 5.74x",
    createdAt: "23:57:50",
  },
  {
    id: "lg_4",
    level: "info",
    service: "auth",
    message: "Login bem-sucedido usr_3e8 (2FA)",
    createdAt: "23:57:22",
  },
  {
    id: "lg_5",
    level: "debug",
    service: "game-engine",
    message: "Tower seed a91f gerada em 3ms",
    createdAt: "23:57:20",
  },
  {
    id: "lg_6",
    level: "error",
    service: "notifications",
    message: "Falha ao enviar push para 12 dispositivos (token expirado)",
    createdAt: "23:55:31",
  },
  {
    id: "lg_7",
    level: "info",
    service: "affiliates",
    message: "Comissão L1 creditada af_2 (R$ 84,00)",
    createdAt: "23:54:10",
  },
  {
    id: "lg_8",
    level: "warn",
    service: "risk",
    message: "Score de risco 78 para usr_9f2 (multi-conta)",
    createdAt: "23:52:47",
  },
];

export const notificationCampaigns: NotificationCampaignDTO[] = [
  {
    id: "nt_1",
    title: "Cashback liberado 🎁",
    channel: "push",
    audience: "Jogadores ativos (7d)",
    status: "sent",
    sentAt: "19/07 20:00",
    openRate: 42.3,
  },
  {
    id: "nt_2",
    title: "Sua meta de hoje",
    channel: "in-app",
    audience: "Todos logados",
    status: "sent",
    sentAt: "19/07 18:00",
    openRate: 71.8,
  },
  {
    id: "nt_3",
    title: "Recupere seu saldo",
    channel: "email",
    audience: "Inativos (30d)",
    status: "scheduled",
    sentAt: "20/07 10:00",
    openRate: 0,
  },
  {
    id: "nt_4",
    title: "Temporada Neon chegando",
    channel: "push",
    audience: "Todos",
    status: "draft",
    sentAt: "—",
    openRate: 0,
  },
];

export const integrations: IntegrationDTO[] = [
  {
    id: "in_1",
    name: "PixFast",
    category: "Gateway de pagamento",
    status: "error",
    lastSyncAt: "há 4 min",
  },
  {
    id: "in_2",
    name: "PagLuz",
    category: "Gateway de pagamento",
    status: "connected",
    lastSyncAt: "há 1 min",
  },
  {
    id: "in_3",
    name: "SendPulse",
    category: "E-mail transacional",
    status: "connected",
    lastSyncAt: "há 8 min",
  },
  {
    id: "in_4",
    name: "OneSignal",
    category: "Push notifications",
    status: "connected",
    lastSyncAt: "há 2 min",
  },
  {
    id: "in_5",
    name: "Metabase",
    category: "BI / Analytics",
    status: "connected",
    lastSyncAt: "há 30 min",
  },
  {
    id: "in_6",
    name: "Slack",
    category: "Alertas internos",
    status: "disconnected",
    lastSyncAt: "há 3 d",
  },
];

export const apiKeys: ApiKeyDTO[] = [
  {
    id: "ak_1",
    name: "Produção — Core",
    prefix: "hj_live_71ac…",
    scopes: ["matches:read", "matches:write", "wallets:read"],
    createdAt: "12/06/2026",
    lastUsedAt: "agora",
    status: "active",
  },
  {
    id: "ak_2",
    name: "Produção — Webhooks",
    prefix: "hj_live_02bd…",
    scopes: ["webhooks:receive"],
    createdAt: "12/06/2026",
    lastUsedAt: "há 2 min",
    status: "active",
  },
  {
    id: "ak_3",
    name: "Sandbox — QA",
    prefix: "hj_test_9f11…",
    scopes: ["*"],
    createdAt: "03/05/2026",
    lastUsedAt: "há 2 d",
    status: "active",
  },
  {
    id: "ak_4",
    name: "Legado — v1",
    prefix: "hj_live_889a…",
    scopes: ["matches:read"],
    createdAt: "10/01/2026",
    lastUsedAt: "há 90 d",
    status: "revoked",
  },
];

export const securityEvents: SecurityEventDTO[] = [
  {
    id: "se_1",
    kind: "Multi-conta detectada",
    user: "usr_9f2k1",
    ip: "177.44.90.12",
    location: "São Paulo, BR",
    riskScore: 78,
    status: "open",
    createdAt: "há 19 min",
  },
  {
    id: "se_2",
    kind: "Tentativas de login (12x)",
    user: "usr_1c9aa",
    ip: "91.203.44.7",
    location: "Kiev, UA",
    riskScore: 92,
    status: "reviewing",
    createdAt: "há 45 min",
  },
  {
    id: "se_3",
    kind: "Chargeback reportado",
    user: "usr_77bd0",
    ip: "200.10.5.88",
    location: "Fortaleza, BR",
    riskScore: 65,
    status: "reviewing",
    createdAt: "há 2 h",
  },
  {
    id: "se_4",
    kind: "VPN + país bloqueado",
    user: "usr_5522f",
    ip: "104.28.1.9",
    location: "—",
    riskScore: 55,
    status: "resolved",
    createdAt: "há 5 h",
  },
];

export const queues: QueueDTO[] = [
  {
    id: "qu_1",
    name: "payments.webhooks",
    pending: 1240,
    processing: 32,
    failed: 18,
    throughputPerMin: 420,
    oldestJobAge: "4m 12s",
    status: "backlogged",
  },
  {
    id: "qu_2",
    name: "notifications.push",
    pending: 86,
    processing: 12,
    failed: 2,
    throughputPerMin: 950,
    oldestJobAge: "8s",
    status: "healthy",
  },
  {
    id: "qu_3",
    name: "affiliates.commissions",
    pending: 12,
    processing: 4,
    failed: 0,
    throughputPerMin: 130,
    oldestJobAge: "3s",
    status: "healthy",
  },
  {
    id: "qu_4",
    name: "reports.exports",
    pending: 3,
    processing: 1,
    failed: 0,
    throughputPerMin: 6,
    oldestJobAge: "40s",
    status: "healthy",
  },
  {
    id: "qu_5",
    name: "emails.marketing",
    pending: 0,
    processing: 0,
    failed: 0,
    throughputPerMin: 0,
    oldestJobAge: "—",
    status: "paused",
  },
];

export const services: ServiceHealthDTO[] = [
  {
    id: "sv_1",
    name: "core-api",
    status: "operational",
    uptime: 99.98,
    latencyP95Ms: 142,
    errorRate: 0.02,
  },
  {
    id: "sv_2",
    name: "game-engine",
    status: "operational",
    uptime: 99.99,
    latencyP95Ms: 38,
    errorRate: 0.01,
  },
  {
    id: "sv_3",
    name: "payments-api",
    status: "degraded",
    uptime: 99.71,
    latencyP95Ms: 890,
    errorRate: 1.8,
  },
  {
    id: "sv_4",
    name: "affiliates",
    status: "operational",
    uptime: 99.95,
    latencyP95Ms: 120,
    errorRate: 0.05,
  },
  {
    id: "sv_5",
    name: "notifications",
    status: "operational",
    uptime: 99.9,
    latencyP95Ms: 210,
    errorRate: 0.4,
  },
];

export const infraNodes: InfraNodeDTO[] = [
  {
    id: "nd_1",
    name: "api-prod-01",
    region: "gru-1 (São Paulo)",
    kind: "API · 8 vCPU / 16 GB",
    cpu: 62,
    memory: 71,
    disk: 44,
    status: "running",
  },
  {
    id: "nd_2",
    name: "api-prod-02",
    region: "gru-1 (São Paulo)",
    kind: "API · 8 vCPU / 16 GB",
    cpu: 58,
    memory: 66,
    disk: 41,
    status: "running",
  },
  {
    id: "nd_3",
    name: "db-primary",
    region: "gru-1 (São Paulo)",
    kind: "PostgreSQL · 16 vCPU / 64 GB",
    cpu: 47,
    memory: 82,
    disk: 63,
    status: "running",
  },
  {
    id: "nd_4",
    name: "db-replica-01",
    region: "gig-1 (Rio de Janeiro)",
    kind: "PostgreSQL réplica",
    cpu: 22,
    memory: 54,
    disk: 61,
    status: "running",
  },
  {
    id: "nd_5",
    name: "worker-queue-01",
    region: "gru-1 (São Paulo)",
    kind: "Workers · 4 vCPU / 8 GB",
    cpu: 88,
    memory: 74,
    disk: 30,
    status: "running",
  },
  {
    id: "nd_6",
    name: "api-canary",
    region: "gru-1 (São Paulo)",
    kind: "API · canário",
    cpu: 0,
    memory: 0,
    disk: 12,
    status: "stopped",
  },
];
