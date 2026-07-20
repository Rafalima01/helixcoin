import { NextResponse } from "next/server";
import { metricsRegistry } from "@/server/observability";

/**
 * Prometheus scrape target. Bypasses the standard createRouteHandler
 * wrapper on purpose — this endpoint gets hit every few seconds by a
 * scraper and shouldn't itself generate log lines or feed its own request
 * count into the metrics it's serving.
 */
export async function GET() {
  const body = await metricsRegistry.metrics();
  return new NextResponse(body, {
    headers: { "Content-Type": metricsRegistry.contentType },
  });
}
