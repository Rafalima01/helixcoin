import { NextResponse } from "next/server";

/**
 * Short referral link — the ONLY link a user shares: /r/CODE.
 * Redirects to signup with the code pre-filled.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(`/signup?ref=${encodeURIComponent(code)}`, req.url);
  return NextResponse.redirect(url);
}
