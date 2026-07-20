import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/server/config/env";
import type { RouteHandler } from "@/server/http/handler";

const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function resolveOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  return allowedOrigins.includes(origin) ? origin : null;
}

function applyCorsHeaders(res: NextResponse, origin: string | null): void {
  if (!origin) return;
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Vary", "Origin");
}

/**
 * CORS for Route Handlers meant to be called cross-origin (mobile apps,
 * partner integrations) — same-origin requests from the Next.js app itself
 * never need this. `CORS_ALLOWED_ORIGINS` is empty by default (allowlist
 * nothing) until a real cross-origin consumer is identified.
 */
export function withCors<Ctx = unknown>(handler: RouteHandler<Ctx>): RouteHandler<Ctx> {
  return async (req, ctx) => {
    const origin = resolveOrigin(req);
    const res = await handler(req, ctx);
    applyCorsHeaders(res, origin);
    return res;
  };
}

/** Handles the browser's preflight OPTIONS request — export as `OPTIONS` alongside a CORS'd GET/POST. */
export function handleCorsPreflight(req: NextRequest): NextResponse {
  const origin = resolveOrigin(req);
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(res, origin);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  return res;
}
