import { NextResponse } from "next/server";
import type { ErrorResult } from "@/server/errors";

/**
 * The one response shape every API route in this codebase returns.
 * Consistency here is what lets the frontend's API client (Phase 3+) parse
 * every endpoint the same way instead of special-casing per route.
 */
export interface ApiSuccessBody<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: number): NextResponse {
  const body: ApiSuccessBody<T> = meta ? { data, meta } : { data };
  return NextResponse.json(body, { status: init ?? 200 });
}

export function created<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return ok(data, meta, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function fail(result: ErrorResult): NextResponse {
  return NextResponse.json(result.body, { status: result.status });
}
