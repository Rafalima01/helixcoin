import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 200));

  const matches = await prisma.match.findMany({
    where: { userId: session.user.id, status: { not: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ matches });
}
