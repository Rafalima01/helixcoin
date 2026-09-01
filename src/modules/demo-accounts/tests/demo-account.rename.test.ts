import { describe, expect, it, vi, beforeEach } from "vitest";
import { DemoAccountService } from "@/modules/demo-accounts/services/demo-account.service";
import { AuthService } from "@/modules/identity/services/auth.service";
import { InMemoryUserRepository } from "@/modules/identity/repositories/user.in-memory-repository";
import { InMemoryUserSessionRepository } from "@/modules/identity/repositories/session.in-memory-repository";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import type { IDemoAccountRepository } from "@/modules/demo-accounts/interfaces/demo-account-repository.interface";
import type { DemoAccountRow } from "@/modules/demo-accounts/entities/demo-account.entity";
import { NotFoundError } from "@/server/errors";
import type { RequestMeta } from "@/modules/identity/services/auth.service";
import type { AdminActor } from "@/modules/identity/services/user-management.service";
import { joinDisplayName, splitDisplayName } from "@/modules/demo-accounts/utils/display-name.util";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/auth/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/tokens")>();
  return {
    ...actual,
    revokeFamily: vi.fn(),
    blacklistFamilyAccessTokens: vi.fn(),
    issueTokenPair: vi.fn(async (_userId: string, _role?: unknown, familyId = "fam_rename") => ({
      accessToken: "access.token",
      refreshToken: "refresh.token",
      sessionId: "sess_rename",
      familyId,
    })),
  };
});

const meta: RequestMeta = { ip: "127.0.0.1", userAgent: "vitest" };
const actor: AdminActor = { id: "admin_1", role: "ADMIN" };

class NoopDemoAccountRepository implements IDemoAccountRepository {
  async list(): Promise<DemoAccountRow[]> {
    return [];
  }
}

function buildService() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemoryUserSessionRepository();
  const wallets = new WalletService(new InMemoryWalletRepository());
  return {
    service: new DemoAccountService(users, sessions, wallets, new NoopDemoAccountRepository()),
    users,
    sessions,
    wallets,
  };
}

/** O mesmo cálculo do repositório de listagem — o que o admin vê na tela. */
async function displayedName(users: InMemoryUserRepository, id: string): Promise<string> {
  const u = await users.findById(id);
  return joinDisplayName(u!.firstName, u!.lastName);
}

describe("splitDisplayName / joinDisplayName", () => {
  it("faz round-trip exato com e sem sobrenome", () => {
    for (const name of ["Influenciador João", "João", "Conta Divulgação Instagram", "Demo Matheus"]) {
      const { firstName, lastName } = splitDisplayName(name);
      expect(joinDisplayName(firstName, lastName)).toBe(name);
    }
  });

  it("colapsa espaços repetidos e remove os das pontas", () => {
    const { firstName, lastName } = splitDisplayName("  Influenciador    João  ");
    expect(joinDisplayName(firstName, lastName)).toBe("Influenciador João");
  });
});

describe("DemoAccountService.rename — Cenário 1: alterar nome", () => {
  beforeEach(() => vi.clearAllMocks());

  it('renomeia "Conta Demo" para "Influenciador João" preservando conta e saldo', async () => {
    const { service, users, wallets } = buildService();
    const created = await service.create(25_000, actor, meta);

    expect(await displayedName(users, created.id)).toBe("Conta Demo");
    const balanceBefore = await wallets.getBalance(created.id);

    await service.rename(created.id, "Influenciador João", actor, meta);

    expect(await displayedName(users, created.id)).toBe("Influenciador João");

    const after = await users.findById(created.id);
    expect(after!.id).toBe(created.id); // mesma conta
    expect((await wallets.getBalance(created.id)).main).toBe(balanceBefore.main); // saldo intacto
    expect(balanceBefore.main).toBe(25_000);
  });

  it("aceita nome sem sobrenome e normaliza espaços", async () => {
    const { service, users } = buildService();
    const created = await service.create(0, actor, meta);

    await service.rename(created.id, "  Matheus  ", actor, meta);
    expect(await displayedName(users, created.id)).toBe("Matheus");

    await service.rename(created.id, "Conta    Divulgação", actor, meta);
    expect(await displayedName(users, created.id)).toBe("Conta Divulgação");
  });

  it("recusa renomear um usuário que não é Conta Demo", async () => {
    const { service, users } = buildService();
    const real = await users.create({
      firstName: "Jogador",
      lastName: "Real",
      username: "jogadorreal",
      email: "real@test.com",
      passwordHash: "hash",
      referralCode: "REAL0001",
      status: "ACTIVE",
      role: "USER",
    });

    await expect(service.rename(real.id, "Hackeado", actor, meta)).rejects.toThrow(NotFoundError);
    expect(await displayedName(users, real.id)).toBe("Jogador Real");
  });
});

describe("DemoAccountService.rename — Cenário 2: login continua funcionando", () => {
  beforeEach(() => vi.clearAllMocks());

  it("telefone, senha e credenciais permanecem inalterados após renomear", async () => {
    const { service, users, sessions } = buildService();
    const created = await service.create(10_000, actor, meta);

    const before = await users.findById(created.id);
    await service.rename(created.id, "Teste Instagram", actor, meta);
    const after = await users.findById(created.id);

    // Nada além do nome pode ter mudado.
    expect(after!.phone).toBe(before!.phone);
    expect(after!.username).toBe(before!.username);
    expect(after!.email).toBe(before!.email);
    expect(after!.passwordHash).toBe(before!.passwordHash);
    expect(after!.referralCode).toBe(before!.referralCode);
    expect(after!.isDemo).toBe(true);
    expect(after!.tags).toEqual(["demo"]);
    expect(after!.status).toBe(before!.status);
    expect(after!.role).toBe(before!.role);

    // E o login real ainda funciona com telefone + senha padrão.
    const auth = new AuthService(users, sessions);
    const session = await auth.login({ email: created.phone, password: created.password }, meta);
    expect(session.user.id).toBe(created.id);
    expect(joinDisplayName(session.user.firstName, session.user.lastName)).toBe("Teste Instagram");
  });
});

describe("DemoAccountService.rename — Cenário 3: isolamento", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renomear uma conta demo não afeta outra conta demo nem um jogador real", async () => {
    const { service, users, wallets } = buildService();

    const alvo = await service.create(10_000, actor, meta);
    const outra = await service.create(30_000, actor, meta);
    await service.rename(outra.id, "Demo Matheus", actor, meta);

    const real = await users.create({
      firstName: "Jogador",
      lastName: "Real",
      username: "outroreal",
      email: "outroreal@test.com",
      passwordHash: "hash-real",
      referralCode: "REAL0002",
      status: "ACTIVE",
      role: "USER",
    });
    await wallets.adjust({
      userId: real.id,
      amountCents: 7_777,
      reason: "setup",
      observation: "setup de teste",
      idempotencyKey: `setup:${real.id}`,
      actor: { actorId: real.id, actorType: "USER" },
    });

    await service.rename(alvo.id, "Influenciador João", actor, meta);

    // A conta alvo mudou...
    expect(await displayedName(users, alvo.id)).toBe("Influenciador João");
    // ...e mais nada mudou.
    expect(await displayedName(users, outra.id)).toBe("Demo Matheus");
    expect(await displayedName(users, real.id)).toBe("Jogador Real");
    expect((await wallets.getBalance(alvo.id)).main).toBe(10_000);
    expect((await wallets.getBalance(outra.id)).main).toBe(30_000);
    expect((await wallets.getBalance(real.id)).main).toBe(7_777);
  });
});

describe("DemoAccountService.create — nome opcional", () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem nome informado, mantém o padrão "Conta Demo"', async () => {
    const { service, users } = buildService();
    const created = await service.create(0, actor, meta);
    expect(await displayedName(users, created.id)).toBe("Conta Demo");
  });

  it("com nome informado, a conta já nasce identificada", async () => {
    const { service, users } = buildService();
    const created = await service.create(0, actor, meta, "Influenciador João");
    expect(await displayedName(users, created.id)).toBe("Influenciador João");

    const stored = await users.findById(created.id);
    expect(stored!.isDemo).toBe(true);
    expect(stored!.tags).toEqual(["demo"]);
    expect(stored!.username).toMatch(/^demo\d{5}$/); // login segue gerado, não vem do nome
  });
});
