import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

async function main() {
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: a.key },
      update: a,
      create: a,
    });
  }

  const demoPasswordHash = await bcrypt.hash("demo1234", 10);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@helijump.gg" },
    update: {},
    create: {
      name: "Jogador Demo",
      email: "demo@helijump.gg",
      passwordHash: demoPasswordHash,
      referralCode: "DEMO2026",
      xp: 1240,
      level: 6,
      wallet: { create: { balance: 25000 } },
    },
  });

  const existingMatches = await prisma.match.count({ where: { userId: demoUser.id } });
  if (existingMatches === 0) {
    await prisma.match.createMany({
      data: [
        {
          userId: demoUser.id,
          betAmount: 1000,
          status: "CASHED_OUT",
          platformsPassed: 14,
          multiplier: 3.1,
          payout: 3100,
          seed: "seed-1",
          resolvedAt: new Date(),
        },
        {
          userId: demoUser.id,
          betAmount: 500,
          status: "LOST",
          platformsPassed: 6,
          multiplier: 1.7,
          payout: 0,
          seed: "seed-2",
          resolvedAt: new Date(),
        },
        {
          userId: demoUser.id,
          betAmount: 2000,
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

  console.log("Seed complete:", demoUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
