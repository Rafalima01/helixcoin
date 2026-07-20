import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation";

function generateReferralCode(name: string) {
  const base =
    name
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 5)
      .toUpperCase() || "PLAYER";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { name, email, password, referralCode } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Este email já está cadastrado" }, { status: 409 });
  }

  let referredById: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (referrer) referredById = referrer.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let code = generateReferralCode(name);
  for (let attempts = 0; attempts < 5; attempts++) {
    const taken = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!taken) break;
    code = generateReferralCode(name);
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      referralCode: code,
      referredById,
      wallet: { create: { balance: 0 } },
    },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
