// Regenera o referralCode de Contas Demo cujo código ainda carrega o padrão
// "demo" — herança de quando DemoAccountService.create chamava
// `generateReferralCode("Demo")`, produzindo códigos como "DEMOK2JV". Esse
// código é público (aparece no Perfil e em "Indique e Ganhe"), então
// anunciava que a conta era demonstrativa.
//
// POR QUE ISSO É SEGURO PARA OS RELACIONAMENTOS
//
//   1. `User.referredById` guarda o UUID do indicador, NUNCA o código. Trocar
//      um referralCode é, por definição, incapaz de romper uma indicação já
//      registrada.
//   2. `AffiliateLink` referencia campanhas por `slug`, não por referralCode.
//   3. `AuthService.register` já ignora o código de uma Conta Demo
//      (`if (referrer && !referrer.isDemo)`), então nenhum cadastro jamais foi
//      atribuído a uma conta demo — esses códigos são funcionalmente inertes.
//
// O único efeito colateral possível seria um link `/r/CODIGO-ANTIGO` já
// distribuído deixar de resolver. Como nenhuma Conta Demo possui indicados, e
// como um cadastro por esse link nunca gerou atribuição, o impacto real é nulo.
//
// PROTEÇÕES
//   - Filtra por `isDemo: true`. Contas reais nunca são tocadas — inclusive o
//     seed "Jogador Demo" (demo@helijump.gg), que é `isDemo: false` e tem o
//     código legítimo "DEMO2026" derivado do próprio nome.
//   - Só altera a coluna `referralCode`. Nada mais é escrito.
//   - Verifica unicidade contra o banco inteiro antes de gravar.
//   - `--dry-run` (padrão) apenas relata; exige `--apply` para gravar.
//
// Uso:
//   npx tsx scripts/regenerate-demo-referral-codes.ts            (simulação)
//   npx tsx scripts/regenerate-demo-referral-codes.ts --apply    (grava)
import { PrismaClient } from "@prisma/client";
import { generateNeutralReferralCode } from "@/modules/identity/utils/referral-code.util";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function uniqueNeutralCode(taken: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateNeutralReferralCode();
    if (taken.has(code)) continue;
    if (await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } })) continue;
    taken.add(code);
    return code;
  }
  throw new Error("Não foi possível gerar um referralCode único após 20 tentativas");
}

async function main() {
  const demos = await prisma.user.findMany({
    where: { isDemo: true, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      referralCode: true,
      _count: { select: { referrals: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const alvos = demos.filter((d) => /demo/i.test(d.referralCode));

  console.log(`Contas Demo: ${demos.length} | com "demo" no código: ${alvos.length}`);
  if (alvos.length === 0) {
    console.log("Nada a fazer.");
    return;
  }

  // Barreira dura: se alguma conta demo tiver indicados, paramos e relatamos em
  // vez de mexer — a premissa de segurança acima deixaria de valer.
  const comIndicados = alvos.filter((d) => d._count.referrals > 0);
  if (comIndicados.length > 0) {
    console.error(
      `ABORTADO: ${comIndicados.length} conta(s) demo possuem indicados. ` +
        `Revise manualmente antes de regenerar:\n` +
        comIndicados.map((d) => `  - ${d.referralCode} (${d._count.referrals} indicados)`).join("\n")
    );
    process.exitCode = 1;
    return;
  }

  const taken = new Set<string>();
  const plano: { id: string; nome: string; de: string; para: string }[] = [];
  for (const d of alvos) {
    plano.push({
      id: d.id,
      nome: `${d.firstName} ${d.lastName}`.trim(),
      de: d.referralCode,
      para: await uniqueNeutralCode(taken),
    });
  }

  console.log(`\n${APPLY ? "APLICANDO" : "SIMULAÇÃO (use --apply para gravar)"}:`);
  for (const p of plano) console.log(`  ${p.de.padEnd(12)} -> ${p.para.padEnd(12)} "${p.nome}"`);

  if (!APPLY) return;

  for (const p of plano) {
    await prisma.user.update({ where: { id: p.id }, data: { referralCode: p.para } });
  }
  console.log(`\n${plano.length} código(s) regenerado(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
