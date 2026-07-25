// Safe-for-production counterpart to prisma/seed.ts — seeds only reference
// data (Permission catalog, RolePermission grants, and — if a real admin
// user already exists — the initial GameEconomyConfig), never a fake user
// account. prisma/seed.ts (`npm run db:seed`) additionally creates
// demo@helijump.gg / admin@helijump.gg with known passwords, which is fine
// for dev but must never run against production.
//
// Run inside a container that already has DATABASE_URL etc. injected (e.g.
// `docker compose run --rm migrate npx tsx scripts/seed-permissions.ts`) —
// this script does not load .env itself.
import { PrismaClient, type Role } from "@prisma/client";
import {
  buildDefaultGeneral,
  buildDefaultModes,
  buildDefaultAntiCheat,
} from "@/modules/game-config/utils/config-defaults.util";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** Permission catalog — independent of roles (see prisma/schema.prisma's RolePermission doc). Kept in sync with prisma/seed.ts's PERMISSIONS. */
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
  { key: "affiliate.applications.read", description: "Visualizar solicitações de afiliados" },
  { key: "affiliate.applications.approve", description: "Aprovar/rejeitar/bloquear afiliados" },
  { key: "affiliate.commissions.read", description: "Visualizar comissões de afiliados" },
  { key: "affiliate.commissions.approve", description: "Aprovar/rejeitar comissões de afiliados" },
  { key: "affiliate.settings.manage", description: "Gerenciar configurações comerciais (CPA/RevShare/níveis)" },
  { key: "manager.read", description: "Visualizar gerentes" },
  { key: "manager.manage", description: "Criar/editar gerentes" },
] as const;

const ROLE_GRANTS: Record<Role, readonly (typeof PERMISSIONS)[number]["key"][]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.key),
  ADMIN: [
    "users.read", "users.create", "users.update", "users.block", "users.restore",
    "sessions.read", "sessions.revoke", "permissions.read", "audit.read",
    "wallet.read", "ledger.read", "game.manage", "rtp.manage", "affiliate.read",
    "affiliate.update", "settings.manage", "reports.export", "matches.read",
    "payments.deposits.read", "payments.withdrawals.read", "payments.withdrawals.approve",
    "payments.gateways.read", "payments.gateways.manage", "payments.webhooks.read",
    "payments.webhooks.manage", "payments.logs.read", "affiliate.applications.read",
    "affiliate.applications.approve", "affiliate.commissions.read",
    "affiliate.commissions.approve", "affiliate.settings.manage", "manager.read", "manager.manage",
  ],
  FINANCE: [
    "wallet.read", "wallet.update", "ledger.read", "finance.read", "reports.export",
    "audit.read", "payments.deposits.read", "payments.withdrawals.read", "payments.withdrawals.approve",
  ],
  OPERATOR: ["game.manage", "rtp.manage", "wallet.read", "matches.read"],
  MODERATOR: ["users.read", "users.block", "sessions.read", "sessions.revoke"],
  SUPPORT: ["users.read", "sessions.read", "sessions.revoke"],
  COMPLIANCE: [
    "users.read", "audit.read", "reports.export", "finance.read", "matches.read", "ledger.read",
    "payments.deposits.read", "payments.withdrawals.read", "payments.gateways.read",
    "payments.webhooks.read", "payments.logs.read", "affiliate.applications.read",
    "affiliate.commissions.read", "manager.read",
  ],
  AUDIT: [
    "audit.read", "users.read", "reports.export", "matches.read", "ledger.read",
    "payments.deposits.read", "payments.withdrawals.read", "payments.gateways.read",
    "payments.webhooks.read", "payments.logs.read", "affiliate.applications.read",
    "affiliate.commissions.read", "manager.read",
  ],
  USER: [],
  AFFILIATE: ["affiliate.read"],
  MANAGER: [],
};

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
  console.log(`Permissions: ${PERMISSIONS.length} catalog entries, grants for ${Object.keys(ROLE_GRANTS).length} roles.`);
}

/** Only runs if a real admin already exists and no config was ever created — never invents a user. */
async function seedGameEconomyConfigIfPossible() {
  const existing = await prisma.gameEconomyConfig.findFirst();
  if (existing) {
    console.log("GameEconomyConfig already exists, skipping.");
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) {
    console.log("No SUPER_ADMIN user found yet — skipping GameEconomyConfig (run this script again after promoting one).");
    return;
  }

  await prisma.gameEconomyConfig.create({
    data: {
      version: 1,
      status: "ACTIVE",
      description: "Configuração inicial (valores padrão do motor de jogo)",
      general: buildDefaultGeneral() as unknown as Prisma.InputJsonValue,
      modes: buildDefaultModes() as unknown as Prisma.InputJsonValue,
      antiCheat: buildDefaultAntiCheat() as unknown as Prisma.InputJsonValue,
      createdById: admin.id,
      activatedAt: new Date(),
    },
  });
  console.log(`GameEconomyConfig v1 activated (createdById: ${admin.id}).`);
}

async function main() {
  await seedPermissions();
  await seedGameEconomyConfigIfPossible();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
