import { NextResponse } from "next/server";
import { openApiSpec } from "@/server/docs/openapi";

export async function GET() {
  return NextResponse.json(openApiSpec);
}
