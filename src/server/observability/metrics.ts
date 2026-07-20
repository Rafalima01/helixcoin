import client from "prom-client";
import { env } from "@/server/config/env";

/**
 * Prometheus metrics registry. `/api/metrics` (Route Handler) exposes this
 * in the standard text exposition format — point a Prometheus scrape config
 * at it, then build Grafana dashboards on top; no code here is
 * Grafana-specific, Prometheus's data model is the only contract.
 */
export const metricsRegistry = new client.Registry();

if (env.METRICS_ENABLED) {
  client.collectDefaultMetrics({ register: metricsRegistry });
}

const labelNames = ["method", "route", "status"] as const;

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests handled",
  labelNames,
  registers: [metricsRegistry],
});

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

/** Called from server/http/handler.ts's route wrapper — the one place that sees every request. */
export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number
): void {
  if (!env.METRICS_ENABLED) return;
  const labels = { method, route, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, durationSeconds);
}
