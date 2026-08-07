import { PrismaClient, Prisma, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";

/** Seed-only stand-ins for src/modules/match-engine's real generators (Phase 5). */
function seedMatchNumber(): string {
  return `HJ-${randomBytes(4).toString("hex").toUpperCase()}`;
}
function seedTokenHash(): string {
  return createHash("sha256").update(randomBytes(24)).digest("hex");
}
import {
  buildDefaultGeneral,
  buildDefaultModes,
  buildDefaultAntiCheat,
} from "@/modules/game-config/utils/config-defaults.util";
import { encrypt } from "@/server/security/crypto-utils";

const prisma = new PrismaClient();

const ACHIEVEMENTS = [
  {
    key: "first_win",
    title: "Primeira Vitória",
    description: "Resgate seu primeiro multiplicador.",
    icon: "trophy",
  },
  { key: "matches_10", title: "Aquecendo", description: "Jogue 10 partidas.", icon: "flame" },
  { key: "matches_100", title: "Veterano", description: "Jogue 100 partidas.", icon: "medal" },
  {
    key: "first_withdraw",
    title: "Primeiro Saque",
    description: "Realize seu primeiro saque via PIX.",
    icon: "wallet",
  },
  {
    key: "multiplier_10x",
    title: "Dez Vezes",
    description: "Alcance um multiplicador de 10x.",
    icon: "zap",
  },
  {
    key: "multiplier_20x",
    title: "Vinte Vezes",
    description: "Alcance um multiplicador de 20x.",
    icon: "rocket",
  },
];

/** Permission catalog — independent of roles (see prisma/schema.prisma's RolePermission doc). */
const PERMISSIONS = [
  { key: "users.read", description: "Visualizar usuários" },
  { key: "users.create", description: "Criar usuários" },
  { key: "users.update", description: "Editar usuários" },
  { key: "users.delete", description: "Excluir (soft delete) usuários" },
  { key: "users.block", description: "Bloquear/desbloquear usuários" },
  { key: "users.restore", description: "Restaurar usuários excluídos" },
  { key: "sessions.read", description: "Visualizar sessões de usuários" },
  { key: "sessions.revoke", description: "Encerrar sessões de usuários" },
  { key: "permissions.read", description: "Visualizar papéis e permissões" },
  { key: "audit.read", description: "Visualizar trilha de auditoria" },
  { key: "wallet.read", description: "Visualizar carteiras" },
  { key: "wallet.update", description: "Ajustar carteiras" },
  { key: "ledger.read", description: "Visualizar livro-razão (ledger)" },
  { key: "game.manage", description: "Gerenciar configurações do jogo" },
  { key: "rtp.manage", description: "Gerenciar RTP" },
  { key: "matches.read", description: "Visualizar partidas" },
  { key: "affiliate.read", description: "Visualizar afiliados" },
  { key: "affiliate.update", description: "Editar afiliados" },
  { key: "settings.manage", description: "Gerenciar configurações da plataforma" },
  { key: "finance.read", description: "Visualizar dados financeiros" },
  { key: "reports.export", description: "Exportar relatórios" },
  { key: "payments.deposits.read", description: "Visualizar depósitos" },
  { key: "payments.withdrawals.read", description: "Visualizar saques" },
  { key: "payments.withdrawals.approve", description: "Aprovar/rejeitar saques" },
  { key: "payments.gateways.read", description: "Visualizar gateways de pagamento" },
  { key: "payments.gateways.manage", description: "Gerenciar gateways de pagamento" },
  { key: "payments.webhooks.read", description: "Visualizar webhooks de pagamento" },
  { key: "payments.webhooks.manage", description: "Reprocessar webhooks de pagamento" },
  { key: "payments.logs.read", description: "Visualizar logs de gateway" },
  { key: "commercial.withdrawals.read", description: "Visualizar saques comerciais (afiliados/gerentes)" },
  { key: "commercial.withdrawals.approve", description: "Aprovar/rejeitar saques comerciais" },
  { key: "affiliate.applications.read", description: "Visualizar solicitações de afiliados" },
  { key: "affiliate.applications.approve", description: "Aprovar/rejeitar/bloquear afiliados" },
  { key: "affiliate.commissions.read", description: "Visualizar comissões de afiliados" },
  { key: "affiliate.commissions.approve", description: "Aprovar/rejeitar comissões de afiliados" },
  { key: "affiliate.settings.manage", description: "Gerenciar configurações comerciais (CPA/RevShare/níveis)" },
  { key: "manager.read", description: "Visualizar gerentes" },
  { key: "manager.manage", description: "Criar/editar gerentes" },
  { key: "notifications.read", description: "Visualizar histórico de push notifications" },
  { key: "notifications.manage", description: "Gerenciar push notifications" },
  { key: "promotions.settings.manage", description: "Gerenciar configurações de promoções (bônus de primeiro depósito)" },
  { key: "demo.accounts.manage", description: "Criar/gerenciar Contas Demo (influenciadores/parceiros)" },
] as const;

/** Default role → permission grants. SUPER_ADMIN bypasses this entirely at runtime (see server/auth/rbac.ts) — listed here only so the backoffice's Permissions screen shows it as "all". */
const ROLE_GRANTS: Record<Role, readonly (typeof PERMISSIONS)[number]["key"][]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.key),
  ADMIN: [
    "users.read",
    "users.create",
    "users.update",
    "users.block",
    "users.restore",
    "sessions.read",
    "sessions.revoke",
    "permissions.read",
    "audit.read",
    "wallet.read",
    "ledger.read",
    "game.manage",
    "rtp.manage",
    "affiliate.read",
    "affiliate.update",
    "settings.manage",
    "reports.export",
    "matches.read",
    "payments.deposits.read",
    "payments.withdrawals.read",
    "payments.withdrawals.approve",
    "payments.gateways.read",
    "payments.gateways.manage",
    "payments.webhooks.read",
    "payments.webhooks.manage",
    "payments.logs.read",
    "commercial.withdrawals.read",
    "commercial.withdrawals.approve",
    "affiliate.applications.read",
    "affiliate.applications.approve",
    "affiliate.commissions.read",
    "affiliate.commissions.approve",
    "affiliate.settings.manage",
    "manager.read",
    "manager.manage",
    "notifications.read",
    "notifications.manage",
    "promotions.settings.manage",
    "demo.accounts.manage",
  ],
  FINANCE: [
    "wallet.read",
    "wallet.update",
    "ledger.read",
    "finance.read",
    "reports.export",
    "audit.read",
    "payments.deposits.read",
    "payments.withdrawals.read",
    "payments.withdrawals.approve",
    "commercial.withdrawals.read",
    "commercial.withdrawals.approve",
  ],
  OPERATOR: ["game.manage", "rtp.manage", "wallet.read", "matches.read"],
  MODERATOR: ["users.read", "users.block", "sessions.read", "sessions.revoke"],
  SUPPORT: ["users.read", "sessions.read", "sessions.revoke"],
  COMPLIANCE: [
    "users.read",
    "audit.read",
    "reports.export",
    "finance.read",
    "matches.read",
    "ledger.read",
    "payments.deposits.read",
    "payments.withdrawals.read",
    "payments.gateways.read",
    "payments.webhooks.read",
    "payments.logs.read",
    "commercial.withdrawals.read",
    "affiliate.applications.read",
    "affiliate.commissions.read",
    "manager.read",
  ],
  AUDIT: [
    "audit.read",
    "users.read",
    "reports.export",
    "matches.read",
    "ledger.read",
    "payments.deposits.read",
    "payments.withdrawals.read",
    "payments.gateways.read",
    "payments.webhooks.read",
    "payments.logs.read",
    "commercial.withdrawals.read",
    "affiliate.applications.read",
    "affiliate.commissions.read",
    "manager.read",
  ],
  USER: [],
  AFFILIATE: ["affiliate.read"],
  // Manager's own portal (src/modules/manager) guards routes by role==="MANAGER"
  // directly, not the PermissionService catalog — managers have no
  // staff/backoffice permission grants of their own (see AGENTS.md Phase 8
  // decision: zero financial/platform visibility).
  MANAGER: [],
};

/**
 * Bootstraps one active MOCK gateway credential + the global PaymentSettings
 * row pointing at it — without this, PaymentService.withFailover has no
 * routable candidate and every deposit/withdraw fails immediately. Real
 * gateways are registered later through the admin Gateways screen; this is
 * only what's needed for the Mock demo flow to work out of the box.
 * Idempotent — skipped if a MOCK credential already exists.
 */
async function seedDefaultMockGateway(createdById: string) {
  const existing = await prisma.gatewayCredential.findFirst({ where: { provider: "MOCK" } });
  const credential =
    existing ??
    (await prisma.gatewayCredential.create({
      data: {
        name: "Mock Gateway (dev)",
        provider: "MOCK",
        mode: "SANDBOX",
        active: true,
        priority: 0,
        credentialsEncrypted: encrypt("{}"),
        webhookSecretEncrypted: encrypt("dev-mock-webhook-secret"),
        createdById,
      },
    }));

  await prisma.paymentSettings.upsert({
    where: { id: "global" },
    update: { defaultGatewayCredentialId: credential.id },
    create: { id: "global", defaultGatewayCredentialId: credential.id },
  });
}

async function seedPermissions() {
  const byKey = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    });
    byKey.set(p.key, row.id);
  }

  for (const [role, keys] of Object.entries(ROLE_GRANTS) as [Role, readonly string[]][]) {
    for (const key of keys) {
      const permissionId = byKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId } },
        update: {},
        create: { role, permissionId },
      });
    }
  }
}

/**
 * Bootstraps GameEconomyConfig version 1 (ACTIVE) from field-registry
 * defaults — those defaults are set to match the previously-hardcoded
 * ENGINE_CONFIG/multiplier.ts/validation.ts values exactly for NORMAL mode,
 * so this doesn't change gameplay for existing players. Skipped if any
 * version already exists (re-running the seed must never clobber an
 * admin's real config).
 */
async function seedGameEconomyConfig(createdById: string) {
  const existing = await prisma.gameEconomyConfig.findFirst();
  if (existing) return;

  await prisma.gameEconomyConfig.create({
    data: {
      version: 1,
      status: "ACTIVE",
      description: "Configuração inicial (valores padrão do motor de jogo)",
      general: buildDefaultGeneral() as unknown as Prisma.InputJsonValue,
      modes: buildDefaultModes() as unknown as Prisma.InputJsonValue,
      antiCheat: buildDefaultAntiCheat() as unknown as Prisma.InputJsonValue,
      createdById,
      activatedAt: new Date(),
    },
  });
}

async function main() {
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: a.key },
      update: a,
      create: a,
    });
  }

  await seedPermissions();

  const demoPasswordHash = await bcrypt.hash("demo1234", 10);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@helijump.gg" },
    update: { tags: ["demo"] },
    create: {
      firstName: "Jogador",
      lastName: "Demo",
      username: "jogador_demo",
      email: "demo@helijump.gg",
      passwordHash: demoPasswordHash,
      // Well-known valid test CPF (passes the real check-digit algorithm) —
      // required now that CPF is mandatory at signup and AmploPay rejects
      // deposits without one; lets local PIX deposit testing work out of
      // the box against this seeded account.
      cpf: "52998224725",
      status: "ACTIVE",
      role: "USER",
      emailVerifiedAt: new Date(),
      referralCode: "DEMO2026",
      xp: 1240,
      level: 6,
      // Manually flagged for Demo mode (src/modules/game-config) — this
      // account is literally the platform demo, so it's the natural fit.
      tags: ["demo"],
      wallet: { create: { balance: 25000 } },
    },
  });

  const adminPasswordHash = await bcrypt.hash("admin1234", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@helijump.gg" },
    update: {},
    create: {
      firstName: "Rafael",
      lastName: "Lima",
      username: "rafael_lima",
      email: "admin@helijump.gg",
      passwordHash: adminPasswordHash,
      status: "ACTIVE",
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
      referralCode: "ADMIN2026",
    },
  });

  await seedGameEconomyConfig(adminUser.id);
  await seedDefaultMockGateway(adminUser.id);

  const existingMatches = await prisma.match.count({ where: { userId: demoUser.id } });
  if (existingMatches === 0) {
    await prisma.match.createMany({
      data: [
        {
          userId: demoUser.id,
          matchNumber: seedMatchNumber(),
          tokenHash: seedTokenHash(),
          betAmount: 1000,
          goalAmount: 5000,
          balanceBefore: 0,
          status: "CASHED_OUT",
          platformsPassed: 14,
          multiplier: 3.1,
          payout: 3100,
          seed: "seed-1",
          resolvedAt: new Date(),
        },
        {
          userId: demoUser.id,
          matchNumber: seedMatchNumber(),
          tokenHash: seedTokenHash(),
          betAmount: 500,
          goalAmount: 2500,
          balanceBefore: 0,
          status: "LOST",
          platformsPassed: 6,
          multiplier: 1.7,
          payout: 0,
          seed: "seed-2",
          resolvedAt: new Date(),
        },
        {
          userId: demoUser.id,
          matchNumber: seedMatchNumber(),
          tokenHash: seedTokenHash(),
          betAmount: 2000,
          goalAmount: 10000,
          balanceBefore: 0,
          status: "CASHED_OUT",
          platformsPassed: 32,
          multiplier: 8.4,
          payout: 16800,
          seed: "seed-3",
          resolvedAt: new Date(),
        },
      ],
    });
  }

  console.log("Seed complete:", demoUser.email, "+ admin@helijump.gg");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
