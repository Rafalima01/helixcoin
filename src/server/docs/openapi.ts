/**
 * Hand-authored OpenAPI 3.0 spec — Phase 2 documents the infra endpoints
 * (health/ready/metrics) as the pattern every future module's routes
 * follow: one entry per path, request/response schemas matching
 * server/http's `{ data, meta? }` success envelope and
 * `{ error: { code, message, details? } }` error envelope exactly, so the
 * spec never drifts from what the route wrapper actually returns.
 *
 * Not generated from Zod schemas (no zod-to-openapi wiring yet) — as real
 * modules land, either keep hand-authoring per route or introduce that
 * generation step; either way this file (or its generated equivalent)
 * stays the single source /api/openapi.json serves.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "HeliJump API",
    version: "0.2.0",
    description:
      "Backend foundation (Phase 2). Business-module endpoints (users, wallets, matches, affiliates, RTP, ...) are documented here as they land in later phases.",
  },
  servers: [{ url: "/api", description: "Same-origin" }],
  tags: [{ name: "Observability", description: "Health, readiness and metrics" }],
  paths: {
    "/health": {
      get: {
        tags: ["Observability"],
        summary: "Liveness probe",
        description: "Checks only that the process can respond — no dependency checks.",
        responses: {
          "200": {
            description: "Process is alive",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        status: { type: "string", example: "ok" },
                        uptimeSeconds: { type: "number", example: 3600 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health/ready": {
      get: {
        tags: ["Observability"],
        summary: "Readiness probe",
        description: "Checks Postgres and Redis connectivity.",
        responses: {
          "200": {
            description: "All dependencies healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReadyStatus" },
              },
            },
          },
          "503": {
            description: "One or more dependencies are unhealthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/metrics": {
      get: {
        tags: ["Observability"],
        summary: "Prometheus metrics",
        description: "Text-exposition format — point a Prometheus scrape config at this.",
        responses: {
          "200": {
            description: "Metrics in Prometheus text format",
            content: { "text/plain": { schema: { type: "string" } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorEnvelope: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string" },
              details: {},
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      ReadyStatus: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok", "degraded"] },
              checks: {
                type: "object",
                properties: {
                  database: { $ref: "#/components/schemas/DependencyCheck" },
                  cache: { $ref: "#/components/schemas/DependencyCheck" },
                },
              },
            },
          },
        },
      },
      DependencyCheck: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ok", "error"] },
          latencyMs: { type: "number" },
          error: { type: "string" },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "server/auth's access token — see src/server/auth/jwt.ts",
      },
    },
  },
} as const;
