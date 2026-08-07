/**
 * Hand-authored OpenAPI 3.0 spec — Phase 2 documents the infra endpoints
 * (health/ready/metrics) as the pattern every future module's routes
 * follow: one entry per path, request/response schemas matching
 * server/http's `{ data, meta? }` success envelope and
 * `{ error: { code, message, details? } }` error envelope exactly, so the
 * spec never drifts from what the route wrapper actually returns.
 *
 * Phase 3 adds the identity module (src/modules/identity) — the platform's
 * sole source of authentication/authorization. Every other module's
 * mutating endpoint should end up requiring `bearerAuth` or `cookieAuth`
 * from here on.
 *
 * Not generated from Zod schemas (no zod-to-openapi wiring yet) — as real
 * modules land, either keep hand-authoring per route or introduce that
 * generation step; either way this file (or its generated equivalent)
 * stays the single source /api/openapi.json serves.
 */

import { API_URL } from "@/config/domains";

const dataEnvelope = (schema: object) => ({
  type: "object",
  properties: { data: schema },
  required: ["data"],
});

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
});

const okEmpty = {
  description: "OK",
  content: {
    "application/json": {
      schema: dataEnvelope({ type: "object", properties: {} }),
    },
  },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "HeliJump API",
    version: "0.7.0",
    description:
      "Backend foundation (Phase 2) + Identity module (Phase 3) + Match Engine (Phase 5) + Wallet/Ledger financial core (Phase 6) + PIX/Gateway payments module (Phase 7). Remaining business-module endpoints (affiliates, cashback, ...) are documented here as they land in later phases.",
  },
  // `/api/**` is served identically by every zone (player/admin/manager) —
  // see src/proxy.ts, which excludes /api from its host-based rewrite
  // entirely — so "same-origin" already works from any of them. The absolute
  // API_URL entry is the documented, DNS-stable entry point for external
  // callers (webhooks, integrations) — see AGENTS.md "Fase Deploy".
  servers: [
    { url: "/api", description: "Same-origin (works from any zone: player, admin, or manager)" },
    { url: `${API_URL}/api`, description: "Absolute API origin" },
  ],
  tags: [
    { name: "Observability", description: "Health, readiness and metrics" },
    { name: "Auth", description: "Register, login, logout, refresh, current user" },
    { name: "Password", description: "Change password, recovery flow" },
    { name: "Email Verification", description: "Mocked email confirmation flow" },
    { name: "MFA", description: "Feature-flagged, not yet integrated" },
    { name: "Sessions", description: "Self-service session management" },
    { name: "Admin Users", description: "Admin user CRUD, search, block/unblock, sessions, history" },
    { name: "Admin Permissions", description: "Permission catalog and role grants (read-only)" },
    { name: "Admin Audit", description: "Immutable audit trail search" },
    { name: "Matches", description: "Match Engine (Phase 5) — player-facing match lifecycle. The frontend never validates a victory on its own; every transition is server-authoritative." },
    { name: "Admin Matches", description: "Match Engine (Phase 5) — read-only backoffice consultation. No mutation endpoint exists here by design." },
    { name: "Wallet", description: "Wallet + Ledger (Phase 6) — player-facing deposit/withdraw. No endpoint here ever mutates a balance directly; every one delegates to WalletService." },
    { name: "Admin Wallets", description: "Wallet + Ledger (Phase 6) — search wallets, inspect balances/history, and the one mutating admin action: manual credit/debit (reason + observation required, always audited)." },
    { name: "Admin Transactions", description: "Wallet + Ledger (Phase 6) — read-only WalletTransaction search/detail." },
    { name: "Admin Ledger", description: "Wallet + Ledger (Phase 6) — read-only double-entry ledger. No mutation endpoint exists anywhere for LedgerEntry — it is append-only by construction (see LedgerService)." },
    { name: "Payments", description: "PIX/Gateway module (Phase 7) — player-facing deposit/withdraw/webhook. PaymentService never moves a balance itself; every confirmed deposit or approved/rejected withdraw calls into WalletService. The frontend never learns which gateway was used." },
    { name: "Admin Payments", description: "PIX/Gateway module (Phase 7) — deposits/withdrawals search+detail(+decide), gateway CRUD+health, webhook search+detail+reprocess, gateway call logs, and global routing settings." },
    { name: "Affiliate", description: "Commercial module (Phase 8) — player-facing affiliate self-service. Reuses the existing referredById/referralCode tree (no second link, no parallel tree); commissions are generated exclusively by CommissionService reacting to Payments' depositConfirmed event, and paid out through the existing Payments withdrawal flow (no new withdrawal code)." },
    { name: "Admin Affiliate", description: "Commercial module (Phase 8) — application approval, manager assignment, commission approval/rejection, and global RevShare/CPA settings." },
    { name: "Manager", description: "Commercial module (Phase 8) — the Manager portal's own API. Purely commercial/oversight: every handler resolves the caller's own ManagerProfile first and scopes all reads to it. No endpoint here ever touches Wallet, Ledger, or Payments — Managers have zero financial permission by design." },
    { name: "Admin Manager", description: "Commercial module (Phase 8) — list/detail managers and promote a User to Manager (the only way a User gains the MANAGER role)." },
  ],
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

    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new player account",
        description: "Public. Creates a PENDING user with role USER. Never returns tokens — call /auth/login next.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterInput" } } } },
        responses: {
          "201": { description: "User created", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { user: { $ref: "#/components/schemas/User" } } }) } } },
          "400": errorResponse("Validation error"),
          "409": errorResponse("Email or username already taken"),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description: "Public, rate-limited by IP (10/min). Sets httpOnly access + refresh cookies; also usable by headless clients reading the tokens is NOT supported over this envelope — tokens never appear in the JSON body.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginInput" } } } },
        responses: {
          "200": { description: "Logged in", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { user: { $ref: "#/components/schemas/User" } } }) } } },
          "401": errorResponse("Invalid credentials"),
          "403": errorResponse("Account cannot authenticate (blocked/suspended)"),
          "422": errorResponse("Account temporarily locked (brute-force protection)"),
          "429": errorResponse("Too many login attempts from this IP"),
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate the refresh token",
        description: "Reads the refresh token from the httpOnly cookie (or `{ refreshToken }` body for headless clients). Single-use rotation — reuse of an already-rotated token revokes the whole session family.",
        responses: {
          "200": okEmpty,
          "401": errorResponse("Invalid, expired, or reused refresh token"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out the current session",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        description: "Revokes the current session family, blacklists the access token for its remaining TTL, clears cookies.",
        responses: { "200": okEmpty, "401": errorResponse("Not authenticated") },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current authenticated user",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { user: { $ref: "#/components/schemas/User" } } }) } } },
          "401": errorResponse("Not authenticated"),
        },
      },
    },

    "/auth/password/change": {
      post: {
        tags: ["Password"],
        summary: "Change the current user's password",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string", minLength: 8, maxLength: 72 },
                  confirmPassword: { type: "string" },
                  revokeOtherSessions: { type: "boolean", default: false },
                },
                required: ["currentPassword", "newPassword", "confirmPassword"],
              },
            },
          },
        },
        responses: { "200": okEmpty, "400": errorResponse("Wrong current password / mismatch"), "401": errorResponse("Not authenticated") },
      },
    },
    "/auth/password/reset/request": {
      post: {
        tags: ["Password"],
        summary: "Request a password reset email (mocked)",
        description: "Public, rate-limited. Always returns 200 regardless of whether the email exists — never reveals account existence.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { email: { type: "string", format: "email" } }, required: ["email"] } } } },
        responses: { "200": okEmpty },
      },
    },
    "/auth/password/reset/confirm": {
      post: {
        tags: ["Password"],
        summary: "Confirm a password reset with the emailed token",
        description: "Public, rate-limited. Revokes every active session on success.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { token: { type: "string" }, newPassword: { type: "string" }, confirmPassword: { type: "string" } },
                required: ["token", "newPassword", "confirmPassword"],
              },
            },
          },
        },
        responses: { "200": okEmpty, "400": errorResponse("Invalid, expired, or already-used token") },
      },
    },

    "/auth/email/verify/request": {
      post: {
        tags: ["Email Verification"],
        summary: "Request an email confirmation link (mocked)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: { "200": okEmpty, "409": errorResponse("Email already verified") },
      },
    },
    "/auth/email/verify/confirm": {
      post: {
        tags: ["Email Verification"],
        summary: "Confirm the emailed verification token",
        description: "Public (token-based).",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] } } } },
        responses: { "200": okEmpty, "400": errorResponse("Invalid/expired token, or issued for a different email") },
      },
    },

    "/auth/mfa": {
      get: {
        tags: ["MFA"],
        summary: "MFA status for the current user",
        description: "Schema fully modeled (TOTP/EMAIL/SMS/recovery codes) but no verification flow is wired — `featureAvailable` reflects the MFA_ENABLED env flag (off by default).",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/MfaStatus" }) } } },
          "401": errorResponse("Not authenticated"),
        },
      },
    },

    "/sessions": {
      get: {
        tags: ["Sessions"],
        summary: "List the current user's own sessions",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/Session" } }) } } },
          "401": errorResponse("Not authenticated"),
        },
      },
    },
    "/sessions/{id}": {
      delete: {
        tags: ["Sessions"],
        summary: "Revoke one of the current user's own sessions",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okEmpty, "401": errorResponse("Not authenticated"), "403": errorResponse("Session belongs to another user"), "404": errorResponse("Session not found") },
      },
    },
    "/sessions/revoke-all": {
      post: {
        tags: ["Sessions"],
        summary: "Revoke every other active session ('log out everywhere else')",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { revokedCount: { type: "integer" } } }) } } },
          "401": errorResponse("Not authenticated"),
        },
      },
    },

    "/admin/users": {
      get: {
        tags: ["Admin Users"],
        summary: "Search/list users",
        description: "Requires the `users.read` permission (staff role gate + PermissionService check).",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Matches name/email/phone/cpf/username/id" },
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "PENDING", "BLOCKED", "SUSPENDED"] } },
          { name: "role", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/User" } }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Missing users.read permission"),
        },
      },
      post: {
        tags: ["Admin Users"],
        summary: "Create a user",
        description: "Requires `users.create`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminCreateUserInput" } } } },
        responses: { "201": { description: "Created", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/User" }) } } }, "403": errorResponse("Missing users.create permission"), "409": errorResponse("Email/username already taken") },
      },
    },
    "/admin/users/{id}": {
      get: {
        tags: ["Admin Users"],
        summary: "Get a user by id",
        description: "Requires `users.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/User" }) } } }, "404": errorResponse("Not found") },
      },
      patch: {
        tags: ["Admin Users"],
        summary: "Update a user",
        description: "Requires `users.update`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUpdateUserInput" } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/User" }) } } }, "409": errorResponse("Email/username already taken") },
      },
      delete: {
        tags: ["Admin Users"],
        summary: "Soft-delete a user",
        description: "Requires `users.delete`. Sets deletedAt — never a hard delete.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okEmpty, "422": errorResponse("Already soft-deleted") },
      },
    },
    "/admin/users/{id}/block": {
      post: {
        tags: ["Admin Users"],
        summary: "Block a user",
        description: "Requires `users.block`. Revokes every active session as a side effect.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { reason: { type: "string" } } } } } },
        responses: { "200": okEmpty, "422": errorResponse("Already blocked") },
      },
    },
    "/admin/users/{id}/unblock": {
      post: {
        tags: ["Admin Users"],
        summary: "Unblock a user",
        description: "Requires `users.block`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okEmpty, "422": errorResponse("Not blocked") },
      },
    },
    "/admin/users/{id}/restore": {
      post: {
        tags: ["Admin Users"],
        summary: "Restore a soft-deleted user",
        description: "Requires `users.restore`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okEmpty, "422": errorResponse("Not deleted") },
      },
    },
    "/admin/users/{id}/sessions": {
      get: {
        tags: ["Admin Users"],
        summary: "List a user's sessions",
        description: "Requires `sessions.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/Session" } }) } } } },
      },
    },
    "/admin/users/{id}/sessions/{sessionId}": {
      delete: {
        tags: ["Admin Users"],
        summary: "Revoke a user's session",
        description: "Requires `sessions.revoke`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": okEmpty, "404": errorResponse("Session not found") },
      },
    },
    "/admin/users/{id}/login-history": {
      get: {
        tags: ["Admin Users"],
        summary: "A user's login history",
        description: "Requires `users.read`. Filtered view over AuditLog (action prefix `auth.`).",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/AuditLog" } }) } } } },
      },
    },

    "/admin/permissions": {
      get: {
        tags: ["Admin Permissions"],
        summary: "Full permission catalog",
        description: "Requires `permissions.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/Permission" } }) } } } },
      },
    },
    "/admin/permissions/roles": {
      get: {
        tags: ["Admin Permissions"],
        summary: "Current role → permission grants",
        description: "Requires `permissions.read`. SUPER_ADMIN bypasses this matrix entirely at runtime (see server/auth/rbac.ts).",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/RolePermissions" } }) } } } },
      },
    },

    "/admin/audit": {
      get: {
        tags: ["Admin Audit"],
        summary: "Search the immutable audit trail",
        description: "Requires `audit.read`. AuditLog rows are append-only — no delete endpoint exists anywhere in the API.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "actorId", in: "query", schema: { type: "string" } },
          { name: "entityType", in: "query", schema: { type: "string" } },
          { name: "entityId", in: "query", schema: { type: "string" } },
          { name: "action", in: "query", schema: { type: "string" }, description: "Prefix match, e.g. `auth.` or `admin.user.`" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/AuditLog" } }) } } } },
      },
    },

    "/matches/start": {
      post: {
        tags: ["Matches"],
        summary: "Create a match",
        description: "Debits the bet, resolves the player's active mode/config, freezes a complete config snapshot on the Match row, and returns a per-match token. The raw token is returned exactly once here — only its hash is ever persisted (mirrors PasswordResetToken) — and must be sent on every subsequent begin/progress/resolve call.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { amount: { type: "number", exclusiveMinimum: 0 } }, required: ["amount"] } } } },
        responses: {
          "201": { description: "Match created (state: AWAITING_START)", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/MatchCreated" }) } } },
          "401": errorResponse("Not authenticated"),
          "422": errorResponse("Bet out of range, or insufficient balance"),
        },
      },
    },
    "/matches/{id}/begin": {
      post: {
        tags: ["Matches"],
        summary: "Transition a match to IN_PROGRESS",
        description: "Called once the game engine actually mounts client-side. AWAITING_START → IN_PROGRESS only — see src/modules/match-engine/utils/match-state-machine.ts for the full transition table.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/MatchProgress" }) } } },
          "403": errorResponse("Wrong match token"),
          "404": errorResponse("Match not found, or not owned by the caller"),
          "422": errorResponse("Match is not in a state that allows this transition"),
        },
      },
    },
    "/matches/{id}/progress": {
      post: {
        tags: ["Matches"],
        summary: "Report an aggregate telemetry checkpoint",
        description: "High-frequency events (platform passed, collision) are tallied client-side and reported here periodically (~every 5s), not one call per event. Runs the Anti-Cheat heuristics on every call and auto-transitions IN_PROGRESS → GOAL_REACHED → CASHOUT_AVAILABLE within the same call once the target multiplier is reached. Rate-limited per IP (RateLimiters.matchProgress).",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MatchProgressInput" } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/MatchProgress" }) } } },
          "403": errorResponse("Wrong match token"),
          "404": errorResponse("Match not found, or not owned by the caller"),
          "422": errorResponse("Match is not active, or Anti-Cheat invalidated it"),
          "429": errorResponse("Too many checkpoints from this IP"),
        },
      },
    },
    "/matches/{id}/resolve": {
      post: {
        tags: ["Matches"],
        summary: "End a match — cashout, loss, or forfeit",
        description: "`cashout` is only permitted when the match is in CASHOUT_AVAILABLE and Anti-Cheat approves the final check — never a partial cashout. `loss`/`forfeit` finalize the match with a zero payout. Idempotent: calling this again on an already-terminal match returns its final state as-is instead of erroring.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MatchResolveInput" } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/MatchResolve" }) } } },
          "403": errorResponse("Wrong match token"),
          "404": errorResponse("Match not found, or not owned by the caller"),
          "422": errorResponse("Cashout requested before the goal was reached, or Anti-Cheat denied it"),
        },
      },
    },
    "/matches": {
      get: {
        tags: ["Matches"],
        summary: "The current user's own resolved match history",
        description: "Only terminal matches (CASHED_OUT/LOST/CANCELLED/INVALIDATED), most recent first — matches still in progress don't appear here.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/MatchSummary" } }) } } },
          "401": errorResponse("Not authenticated"),
        },
      },
    },

    "/admin/matches": {
      get: {
        tags: ["Admin Matches"],
        summary: "List/filter matches",
        description: "Requires the `matches.read` permission. Read-only — no create/update/delete endpoint exists for matches anywhere in the API.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/MatchStatus" } },
          { name: "mode", in: "query", schema: { type: "string", enum: ["DEMO", "NORMAL", "HARD"] } },
          { name: "userId", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/MatchSummary" } }) } } },
          "403": errorResponse("Missing matches.read permission"),
        },
      },
    },
    "/admin/matches/{id}": {
      get: {
        tags: ["Admin Matches"],
        summary: "Full match detail, including the config snapshot and event timeline",
        description: "Requires `matches.read`. tokenHash is never included in the response, even here.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/MatchDetail" }) } } },
          "403": errorResponse("Missing matches.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },

    "/payments/deposits": {
      post: {
        tags: ["Payments"],
        summary: "Create a PIX deposit charge",
        description: "PaymentService picks the active gateway (routing/failover, see PaymentSettings.routingMode) and calls its createPixDeposit(). No balance effect yet — deposits move zero money until a webhook confirms payment. Min/max are enforced against PaymentSettings.depositMinCents/depositMaxCents, not a hardcoded range.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { amount: { type: "number", exclusiveMinimum: 0, description: "Reais" } }, required: ["amount"] } } } },
        responses: {
          "201": { description: "PIX charge created", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { depositId: { type: "string" }, pixCode: { type: "string" }, qrCodeUrl: { type: "string", nullable: true }, expiresAt: { type: "string", format: "date-time", nullable: true }, amountCents: { type: "integer" }, status: { $ref: "#/components/schemas/DepositStatus" } } }) } } },
          "401": errorResponse("Not authenticated"),
          "422": errorResponse("Amount outside PaymentSettings range, or no active gateway"),
        },
      },
    },
    "/payments/deposits/{id}": {
      get: {
        tags: ["Payments"],
        summary: "Get a deposit (ownership-checked)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/Deposit" }) } } },
          "403": errorResponse("Deposit belongs to another user"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/payments/deposits/{id}/simulate": {
      post: {
        tags: ["Payments"],
        summary: "Simulate the gateway confirming/failing this deposit (MOCK only)",
        description: "Builds a real HMAC-signed webhook payload via MockProvider.buildWebhookPayload and settles it through the exact same PaymentService.handleWebhook path a real webhook would use. Guarded to gateway provider MOCK.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { outcome: { type: "string", enum: ["PAID", "FAILED"], default: "PAID" } } } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { status: { type: "integer" } } }) } } },
          "403": errorResponse("Deposit belongs to another user"),
          "422": errorResponse("Deposit not PENDING, or gateway is not MOCK"),
        },
      },
    },
    "/payments/withdrawals": {
      post: {
        tags: ["Payments"],
        summary: "Request a withdrawal",
        description: "Locks the requested amount (WalletService.lock, MAIN → LOCKED) BEFORE calling the gateway — funds are never left unaccounted for. If every gateway candidate rejects the request, the lock is immediately reversed. Status is always PENDING in the response, never an assumed-final balance.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { amount: { type: "number", exclusiveMinimum: 0, description: "Reais" }, pixKey: { type: "string", minLength: 3 }, pixKeyType: { type: "string", enum: ["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"] } }, required: ["amount", "pixKey"] } } } },
        responses: {
          "201": { description: "Withdrawal requested, funds locked", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { withdrawId: { type: "string" }, status: { $ref: "#/components/schemas/WithdrawStatus" }, amountCents: { type: "integer" } } }) } } },
          "401": errorResponse("Not authenticated"),
          "422": errorResponse("Insufficient balance, amount outside PaymentSettings range, or no active gateway"),
        },
      },
    },
    "/payments/webhook/{provider}": {
      post: {
        tags: ["Payments"],
        summary: "Gateway webhook receiver — no auth, signature is the authentication",
        description: "No withAuth — external gateway callers. Rate-limited by IP (RateLimiters.webhooks). Reads the RAW request body (signatures are verified over the raw string, never parsed JSON). Tries every registered credential for `provider` until one validates; never reveals which check failed. Idempotent on providerEventId (falls back to a payloadHash dedup) — a replayed delivery is safe. Always responds fast: settlement failures return 500 (so the gateway retries) rather than throwing past the handler.",
        parameters: [{ name: "provider", in: "path", required: true, schema: { $ref: "#/components/schemas/GatewayProvider" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", description: "Raw gateway payload — shape is provider-specific" } } } },
        responses: {
          "200": { description: "Settled (or already-processed replay)", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { status: { type: "integer" } } }) } } },
          "401": errorResponse("No registered credential validated the signature"),
          "404": errorResponse("providerTransactionId does not match a known Deposit/Withdraw"),
          "429": errorResponse("Rate limited"),
        },
      },
    },

    "/admin/payments/deposits": {
      get: {
        tags: ["Admin Payments"],
        summary: "Search/filter deposits",
        description: "Requires `payments.deposits.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/DepositStatus" } },
          { name: "gatewayCredentialId", in: "query", schema: { type: "string" } },
          { name: "userId", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/DepositAdmin" } }) } } },
          "403": errorResponse("Missing payments.deposits.read permission"),
        },
      },
    },
    "/admin/payments/deposits/{id}": {
      get: {
        tags: ["Admin Payments"],
        summary: "Full deposit detail",
        description: "Requires `payments.deposits.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/DepositAdmin" }) } } },
          "403": errorResponse("Missing payments.deposits.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/payments/withdrawals": {
      get: {
        tags: ["Admin Payments"],
        summary: "Search/filter withdrawals",
        description: "Requires `payments.withdrawals.read`. `pixKeyMasked` only — the encrypted PIX key is never returned.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/WithdrawStatus" } },
          { name: "gatewayCredentialId", in: "query", schema: { type: "string" } },
          { name: "userId", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/WithdrawAdmin" } }) } } },
          "403": errorResponse("Missing payments.withdrawals.read permission"),
        },
      },
    },
    "/admin/payments/withdrawals/{id}": {
      get: {
        tags: ["Admin Payments"],
        summary: "Full withdrawal detail",
        description: "Requires `payments.withdrawals.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/WithdrawAdmin" }) } } },
          "403": errorResponse("Missing payments.withdrawals.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/payments/withdrawals/{id}/decide": {
      post: {
        tags: ["Admin Payments"],
        summary: "Approve or reject a pending withdrawal (MOCK only)",
        description: "Requires `payments.withdrawals.approve`. Same signed-webhook settlement path as the player deposit simulate action — builds a real HMAC payload via MockProvider.buildWebhookPayload and calls PaymentService.handleWebhook. APPROVE debits the LOCKED bucket directly (no separate unlock step); REJECT only unlocks (funds return to MAIN). `rejectionReason` required when action is REJECT.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { action: { type: "string", enum: ["APPROVE", "REJECT"] }, rejectionReason: { type: "string", minLength: 3 } }, required: ["action"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { status: { type: "integer" } } }) } } },
          "400": errorResponse("REJECT without rejectionReason"),
          "403": errorResponse("Missing payments.withdrawals.approve permission"),
          "422": errorResponse("Withdrawal already processed, or gateway is not MOCK"),
        },
      },
    },
    "/admin/payments/gateways": {
      get: {
        tags: ["Admin Payments"],
        summary: "List gateway credentials",
        description: "Requires `payments.gateways.read`. Never returns `credentialsEncrypted`/`webhookSecretEncrypted`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "provider", in: "query", schema: { $ref: "#/components/schemas/GatewayProvider" } },
          { name: "active", in: "query", schema: { type: "boolean" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/GatewayCredentialAdmin" } }) } } },
          "403": errorResponse("Missing payments.gateways.read permission"),
        },
      },
      post: {
        tags: ["Admin Payments"],
        summary: "Register a new gateway credential",
        description: "Requires `payments.gateways.manage`. `credentials` (provider-specific JSON) and `webhookSecret` are AES-256-GCM encrypted before storage — never persisted in plain text. Only `provider: MOCK` is functional this phase; other providers register structurally (NotImplementedProvider) for future gateways.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 2 },
                  provider: { $ref: "#/components/schemas/GatewayProvider" },
                  mode: { type: "string", enum: ["SANDBOX", "PRODUCTION"], default: "SANDBOX" },
                  credentials: { type: "object", description: "Provider-specific JSON, encrypted at rest" },
                  webhookSecret: { type: "string", minLength: 8 },
                  active: { type: "boolean", default: false },
                  priority: { type: "integer", default: 0 },
                  weight: { type: "integer", default: 1 },
                  timeoutMs: { type: "integer", default: 15000 },
                  maxRetries: { type: "integer", default: 2 },
                  simulatedHealth: { $ref: "#/components/schemas/GatewayHealthStatus" },
                },
                required: ["name", "provider", "webhookSecret"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/GatewayCredentialAdmin" }) } } },
          "400": errorResponse("Invalid input"),
          "403": errorResponse("Missing payments.gateways.manage permission"),
        },
      },
    },
    "/admin/payments/gateways/{id}": {
      get: {
        tags: ["Admin Payments"],
        summary: "Full gateway credential detail (with latest health check)",
        description: "Requires `payments.gateways.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/GatewayCredentialAdmin" }) } } },
          "403": errorResponse("Missing payments.gateways.read permission"),
          "404": errorResponse("Not found"),
        },
      },
      patch: {
        tags: ["Admin Payments"],
        summary: "Update a gateway credential",
        description: "Requires `payments.gateways.manage`. `credentials`/`webhookSecret`, when provided, are re-encrypted — never merged with the previous plaintext. `simulatedHealth` is the Mock-only failover test lever (ONLINE/DEGRADED/OFFLINE/null-for-real).",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", description: "Partial update — same shape as create, minus provider" } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/GatewayCredentialAdmin" }) } } },
          "403": errorResponse("Missing payments.gateways.manage permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/payments/gateways/{id}/test-connection": {
      post: {
        tags: ["Admin Payments"],
        summary: "Run a live health check against this gateway",
        description: "Requires `payments.gateways.manage`. Calls provider.health(), writes an append-only GatewayHealth row, and publishes gatewayUnavailable/gatewayRecovered if the status changed since the last check.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { status: { $ref: "#/components/schemas/GatewayHealthStatus" }, latencyMs: { type: "integer" }, message: { type: "string" } } }) } } },
          "403": errorResponse("Missing payments.gateways.manage permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/payments/webhooks": {
      get: {
        tags: ["Admin Payments"],
        summary: "Search/filter received webhooks",
        description: "Requires `payments.webhooks.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["RECEIVED", "PROCESSED", "ERROR", "REPROCESSED"] } },
          { name: "provider", in: "query", schema: { $ref: "#/components/schemas/GatewayProvider" } },
          { name: "relatedType", in: "query", schema: { type: "string", enum: ["DEPOSIT", "WITHDRAW"] } },
          { name: "relatedId", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/PaymentWebhookAdmin" } }) } } },
          "403": errorResponse("Missing payments.webhooks.read permission"),
        },
      },
    },
    "/admin/payments/webhooks/{id}": {
      get: {
        tags: ["Admin Payments"],
        summary: "Full webhook detail, including payload/response",
        description: "Requires `payments.webhooks.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/PaymentWebhookAdmin" }) } } },
          "403": errorResponse("Missing payments.webhooks.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/payments/webhooks/{id}/reprocess": {
      post: {
        tags: ["Admin Payments"],
        summary: "Re-run settlement for an already-stored webhook",
        description: "Requires `payments.webhooks.manage`. Re-runs PaymentService's settlement logic from the already-verified, already-stored payload — no fresh signature needed. Safe to call on an already-PROCESSED webhook (every settlement branch re-checks current Deposit/Withdraw status, on top of WalletService's own idempotency-key guarantee).",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { status: { type: "integer" } } }) } } },
          "403": errorResponse("Missing payments.webhooks.manage permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/payments/logs": {
      get: {
        tags: ["Admin Payments"],
        summary: "Search/filter gateway call logs (outbound calls + inbound webhooks)",
        description: "Requires `payments.logs.read`. `requestSummary`/`responseSummary` are always pre-sanitized at the call site — this endpoint never returns a credential or webhook secret.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "provider", in: "query", schema: { $ref: "#/components/schemas/GatewayProvider" } },
          { name: "direction", in: "query", schema: { type: "string", enum: ["outbound", "inbound"] } },
          { name: "correlationId", in: "query", schema: { type: "string" } },
          { name: "success", in: "query", schema: { type: "boolean" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/GatewayLogAdmin" } }) } } },
          "403": errorResponse("Missing payments.logs.read permission"),
        },
      },
    },
    "/admin/payments/settings": {
      get: {
        tags: ["Admin Payments"],
        summary: "Get global payment settings",
        description: "Requires `payments.gateways.read`. Single row (id \"global\") — routing mode, default gateway, timeouts/retries, PIX expiration, deposit/withdraw min/max.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/PaymentSettings" }) } } },
          "403": errorResponse("Missing payments.gateways.read permission"),
        },
      },
      put: {
        tags: ["Admin Payments"],
        summary: "Update global payment settings",
        description: "Requires `payments.gateways.manage`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", description: "Partial update — any subset of PaymentSettings fields" } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/PaymentSettings" }) } } },
          "403": errorResponse("Missing payments.gateways.manage permission"),
        },
      },
    },

    "/admin/wallets": {
      get: {
        tags: ["Admin Wallets"],
        summary: "Search/list wallets",
        description: "Requires `wallet.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Matches user name/email or userId" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/WalletAdminSummary" } }) } } },
          "403": errorResponse("Missing wallet.read permission"),
        },
      },
    },
    "/admin/wallets/{userId}": {
      get: {
        tags: ["Admin Wallets"],
        summary: "Wallet balances + recent transactions for one user",
        description: "Requires `wallet.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { balances: { $ref: "#/components/schemas/WalletBalances" }, recentTransactions: { type: "array", items: { $ref: "#/components/schemas/WalletTransaction" } } } }) } } },
          "403": errorResponse("Missing wallet.read permission"),
        },
      },
    },
    "/admin/wallets/{userId}/adjust": {
      post: {
        tags: ["Admin Wallets"],
        summary: "Manual credit/debit",
        description: "Requires `wallet.update`. `reason` and `observation` are mandatory — every call writes a Ledger entry, a WalletTransaction (type ADJUSTMENT), a WalletAdjusted event, and an AuditLog row (actor, before/after, IP). Never a silent balance change.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  amount: { type: "number", description: "Cents, signed — positive credits, negative debits" },
                  account: { $ref: "#/components/schemas/WalletAccount" },
                  reason: { type: "string", minLength: 3 },
                  observation: { type: "string", minLength: 3 },
                },
                required: ["amount", "reason", "observation"],
              },
            },
          },
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { balances: { $ref: "#/components/schemas/WalletBalances" }, transaction: { $ref: "#/components/schemas/WalletTransaction" } } }) } } },
          "400": errorResponse("Missing reason/observation, or zero amount"),
          "403": errorResponse("Missing wallet.update permission"),
        },
      },
    },

    "/admin/transactions": {
      get: {
        tags: ["Admin Transactions"],
        summary: "Search/filter WalletTransaction rows",
        description: "Requires `wallet.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "type", in: "query", schema: { $ref: "#/components/schemas/TransactionType" } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/TransactionStatus" } },
          { name: "userId", in: "query", schema: { type: "string" } },
          { name: "origin", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "minAmount", in: "query", schema: { type: "integer" } },
          { name: "maxAmount", in: "query", schema: { type: "integer" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/WalletTransaction" } }) } } },
          "403": errorResponse("Missing wallet.read permission"),
        },
      },
    },
    "/admin/transactions/{id}": {
      get: {
        tags: ["Admin Transactions"],
        summary: "Full WalletTransaction detail, including metadata",
        description: "Requires `wallet.read`. `idempotencyKey` is deliberately never included — internal correlation detail, not admin-facing.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/WalletTransaction" }) } } },
          "403": errorResponse("Missing wallet.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },

    "/admin/ledger": {
      get: {
        tags: ["Admin Ledger"],
        summary: "Search/filter LedgerEntry rows",
        description: "Requires `ledger.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "debitAccount", in: "query", schema: { type: "string" }, description: "Exact match, e.g. PLATFORM or WALLET:{userId}:MAIN" },
          { name: "creditAccount", in: "query", schema: { type: "string" } },
          { name: "reference", in: "query", schema: { type: "string" } },
          { name: "referenceType", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/LedgerEntry" } }) } } },
          "403": errorResponse("Missing ledger.read permission"),
        },
      },
    },
    "/admin/ledger/{id}": {
      get: {
        tags: ["Admin Ledger"],
        summary: "Full LedgerEntry detail",
        description: "Requires `ledger.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/LedgerEntry" }) } } },
          "403": errorResponse("Missing ledger.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },

    "/affiliate/apply": {
      post: {
        tags: ["Affiliate"],
        summary: "Apply to become an affiliate",
        description: "Creates a PENDING AffiliateProfile for the caller. `managerCode` (a ManagerProfile.inviteCode) auto-assigns a manager; omit it to leave the application unassigned for admin manual assignment. A user can only ever have one AffiliateProfile.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { managerCode: { type: "string" }, pixKey: { type: "string", minLength: 3 } } } } } },
        responses: {
          "201": { description: "Application created", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateProfile" }) } } },
          "401": errorResponse("Not authenticated"),
          "409": errorResponse("Already has an affiliate application"),
        },
      },
    },
    "/affiliate/me": {
      get: {
        tags: ["Affiliate"],
        summary: "Get the caller's own affiliate profile",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateProfile" }) } } },
          "401": errorResponse("Not authenticated"),
          "404": errorResponse("No affiliate profile"),
        },
      },
    },
    "/affiliate/dashboard": {
      get: {
        tags: ["Affiliate"],
        summary: "Aggregated commission KPIs for the caller",
        description: "All totals come from src/modules/affiliate's Commission table (commissionRepository.sumAmountCents) — never a live Wallet read.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateDashboard" }) } } },
          "401": errorResponse("Not authenticated"),
          "404": errorResponse("No affiliate profile"),
        },
      },
    },
    "/affiliate/links": {
      get: {
        tags: ["Affiliate"],
        summary: "List the caller's campaign links",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/AffiliateLink" } }) } } },
          "401": errorResponse("Not authenticated"),
          "404": errorResponse("No affiliate profile"),
        },
      },
      post: {
        tags: ["Affiliate"],
        summary: "Create a named campaign link",
        description: "A thin analytics wrapper over the caller's one and only referral code (User.referralCode) — never a second attribution mechanism. Shared as /r/{referralCode}?l={slug}.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string", minLength: 2, maxLength: 60 } }, required: ["name"] } } } },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateLink" }) } } },
          "401": errorResponse("Not authenticated"),
          "404": errorResponse("No affiliate profile"),
        },
      },
    },
    "/affiliate/links/{id}": {
      patch: {
        tags: ["Affiliate"],
        summary: "Pause or reactivate a campaign link",
        description: "Pausing only stops that slug from being trackable going forward — the affiliate's core referral code always keeps working.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["ACTIVE", "PAUSED"] } } } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateLink" }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Link belongs to another affiliate"),
          "404": errorResponse("Not found"),
        },
      },
      delete: {
        tags: ["Affiliate"],
        summary: "Delete a campaign link",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { deleted: { type: "boolean" } } }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Link belongs to another affiliate"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/affiliate/commissions": {
      get: {
        tags: ["Affiliate"],
        summary: "Paginated commission history for the caller",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/Commission" } }) } } },
          "401": errorResponse("Not authenticated"),
          "404": errorResponse("No affiliate profile"),
        },
      },
    },

    "/admin/affiliate/applications": {
      get: {
        tags: ["Admin Affiliate"],
        summary: "Search/filter affiliate applications",
        description: "Requires `affiliate.applications.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/AffiliateStatus" } },
          { name: "managerId", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/AffiliateProfileAdmin" } }) } } },
          "403": errorResponse("Missing affiliate.applications.read permission"),
        },
      },
    },
    "/admin/affiliate/applications/{id}": {
      get: {
        tags: ["Admin Affiliate"],
        summary: "Full affiliate application detail",
        description: "Requires `affiliate.applications.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateProfileAdmin" }) } } },
          "403": errorResponse("Missing affiliate.applications.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/affiliate/applications/{id}/decide": {
      post: {
        tags: ["Admin Affiliate"],
        summary: "Approve, reject, block, or request documents for an affiliate application",
        description: "Requires `affiliate.applications.approve`. `reason` is required for every action except APPROVE. An already-APPROVED affiliate can only receive the BLOCK action.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { action: { type: "string", enum: ["APPROVE", "REJECT", "BLOCK", "REQUEST_DOCUMENTS"] }, reason: { type: "string", minLength: 3 } }, required: ["action"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateProfileAdmin" }) } } },
          "400": errorResponse("Missing reason for a non-APPROVE action"),
          "403": errorResponse("Missing affiliate.applications.approve permission"),
          "404": errorResponse("Not found"),
          "422": errorResponse("Affiliate already approved (and action is not BLOCK)"),
        },
      },
    },
    "/admin/affiliate/applications/{id}/assign-manager": {
      post: {
        tags: ["Admin Affiliate"],
        summary: "Assign or unassign the manager for an affiliate",
        description: "Requires `affiliate.applications.approve`. Pass `managerId: null` to unassign.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { managerId: { type: "string", nullable: true } }, required: ["managerId"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateProfileAdmin" }) } } },
          "403": errorResponse("Missing affiliate.applications.approve permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/affiliate/commissions": {
      get: {
        tags: ["Admin Affiliate"],
        summary: "Search/filter commissions",
        description: "Requires `affiliate.commissions.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "affiliateId", in: "query", schema: { type: "string" } },
          { name: "managerId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/CommissionStatus" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/CommissionAdmin" } }) } } },
          "403": errorResponse("Missing affiliate.commissions.read permission"),
        },
      },
    },
    "/admin/affiliate/commissions/{id}/decide": {
      post: {
        tags: ["Admin Affiliate"],
        summary: "Approve or reject a LOCKED commission",
        description: "Requires `affiliate.commissions.approve`. APPROVE unlocks LOCKED → MAIN via WalletService (CommissionApproved). REJECT debits the LOCKED bucket back out entirely, with a matching Ledger reversal — `reason` required.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { action: { type: "string", enum: ["APPROVE", "REJECT"] }, reason: { type: "string", minLength: 3 } }, required: ["action"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { id: { type: "string" }, status: { $ref: "#/components/schemas/CommissionStatus" } } }) } } },
          "400": errorResponse("REJECT without reason"),
          "403": errorResponse("Missing affiliate.commissions.approve permission"),
          "404": errorResponse("Not found"),
          "422": errorResponse("Commission is not LOCKED"),
        },
      },
    },
    "/admin/affiliate/settings": {
      get: {
        tags: ["Admin Affiliate"],
        summary: "Get the global AffiliateSettings row",
        description: "Requires `affiliate.settings.manage`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateSettings" }) } } },
          "403": errorResponse("Missing affiliate.settings.manage permission"),
        },
      },
      put: {
        tags: ["Admin Affiliate"],
        summary: "Update RevShare/CPA percentages and approval rules",
        description: "Requires `affiliate.settings.manage`. Every field is optional/partial.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { revShareLevel1Percent: { type: "number", minimum: 0, maximum: 1 }, revShareLevel2Percent: { type: "number", minimum: 0, maximum: 1 }, revShareLevel3Percent: { type: "number", minimum: 0, maximum: 1 }, cpaAmountCents: { type: "integer", minimum: 0 }, autoApproveCommissions: { type: "boolean" }, requireManagerApprovalForAffiliates: { type: "boolean" } } } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateSettings" }) } } },
          "403": errorResponse("Missing affiliate.settings.manage permission"),
        },
      },
    },

    "/manager/me": {
      get: {
        tags: ["Manager"],
        summary: "Get the caller's own ManagerProfile",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerProfile" }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Not a manager"),
          "404": errorResponse("No manager profile"),
        },
      },
    },
    "/manager/dashboard": {
      get: {
        tags: ["Manager"],
        summary: "Aggregated, informational-only network stats",
        description: "Every number comes from src/modules/affiliate's Commission table via ICommissionRepository — never Wallet/Ledger. Manager has zero financial permission by design.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerDashboard" }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Not a manager"),
        },
      },
    },
    "/manager/approvals": {
      get: {
        tags: ["Manager"],
        summary: "List PENDING affiliate applications in the caller's own network",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/AffiliateProfileAdmin" } }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Not a manager"),
        },
      },
    },
    "/manager/approvals/{id}/decide": {
      post: {
        tags: ["Manager"],
        summary: "Approve or reject an affiliate application in the caller's own network",
        description: "Only works when both (a) the affiliate belongs to this manager and (b) AffiliateSettings.requireManagerApprovalForAffiliates is enabled — otherwise 403. Delegates the actual state transition to the same AffiliateService.decide() the admin endpoint uses.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { action: { type: "string", enum: ["APPROVE", "REJECT", "BLOCK", "REQUEST_DOCUMENTS"] }, reason: { type: "string", minLength: 3 } }, required: ["action"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateProfileAdmin" }) } } },
          "400": errorResponse("Missing reason for a non-APPROVE action"),
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Not a manager, affiliate outside this manager's network, or requireManagerApprovalForAffiliates disabled"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/manager/network": {
      get: {
        tags: ["Manager"],
        summary: "List every affiliate in the caller's own network, with the per-affiliate financial rollup",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/AffiliateNetworkStats" } }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Not a manager"),
        },
      },
    },
    "/manager/network/{id}": {
      get: {
        tags: ["Manager"],
        summary: "Get one affiliate's detail from the caller's own network",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateProfileAdmin" }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Not a manager, or affiliate belongs to a different manager"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/manager/network/{id}/commission": {
      patch: {
        tags: ["Manager"],
        summary: "Set one of the caller's network affiliates' commission percentage",
        description: "Refinamento Fase 8 — `percent` (0-100) is server-validated against the caller's own ManagerProfile.commissionPercent ceiling; an affiliate can never be set above it. Never trusts a frontend-supplied percentage beyond that range check.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, description: "AffiliateProfile id", schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { percent: { type: "number", minimum: 0, maximum: 100 } }, required: ["percent"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/AffiliateProfileAdmin" }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Not a manager, or affiliate belongs to a different manager"),
          "404": errorResponse("Not found"),
          "422": errorResponse("percent exceeds the manager's own commission ceiling"),
        },
      },
    },
    "/manager/links": {
      get: {
        tags: ["Manager"],
        summary: "The caller's two-link model with click/signup/conversion stats",
        description: "Refinamento Fase 8. `platformLink` is /r/{referralCode} (captures players directly, full-ceiling commission); `inviteLink` is /affiliate/invite/{inviteCode} (recruits affiliates only, never players).",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerLinks" }) } } },
          "401": errorResponse("Not authenticated"),
          "403": errorResponse("Not a manager"),
        },
      },
    },

    "/admin/manager": {
      get: {
        tags: ["Admin Manager"],
        summary: "Search/filter managers",
        description: "Requires `manager.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/ManagerProfileAdmin" } }) } } },
          "403": errorResponse("Missing manager.read permission"),
        },
      },
    },
    "/admin/manager/{id}": {
      get: {
        tags: ["Admin Manager"],
        summary: "Full manager detail",
        description: "Requires `manager.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerProfileAdmin" }) } } },
          "403": errorResponse("Missing manager.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/manager/{id}/activate": {
      patch: {
        tags: ["Admin Manager"],
        summary: "PENDING -> ACTIVE — unblock /manager portal access",
        description: "Requires `manager.manage`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerProfile" }) } } },
          "403": errorResponse("Missing manager.manage permission"),
          "404": errorResponse("Not found"),
          "422": errorResponse("Manager already active"),
        },
      },
    },
    "/admin/manager/{id}/commission": {
      patch: {
        tags: ["Admin Manager"],
        summary: "Edit a manager's commission ceiling after onboarding",
        description: "Requires `manager.manage`. Editing this does NOT retroactively cap any affiliate already set above the new value — enforcement only applies going forward, on the next AffiliateService.updateCommission() call.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { commissionPercent: { type: "number", minimum: 0, maximum: 100 } }, required: ["commissionPercent"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerProfile" }) } } },
          "403": errorResponse("Missing manager.manage permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/manager/invites": {
      get: {
        tags: ["Admin Manager"],
        summary: "List manager onboarding invites",
        description: "Requires `manager.read`.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "EXPIRED", "REVOKED", "USED"] } },
          { name: "approvalStatus", in: "query", schema: { type: "string", enum: ["PENDING_REVIEW", "APPROVED", "REJECTED"] } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/ManagerInviteAdmin" } }) } } },
          "403": errorResponse("Missing manager.read permission"),
        },
      },
      post: {
        tags: ["Admin Manager"],
        summary: "Generate a manager onboarding invite link",
        description: "Requires `manager.manage`. Cadastro de Gerente — the Admin never supplies candidate identity; the invite carries no name/email/phone at creation, only a bare token. The candidate fills their own Nome/Email/Telefone/Senha when redeeming it (see POST /manager-invites/{token}/accept), and commission/portal access are decided later, at approval (see POST .../invites/{id}/approve). The raw, redeemable link is returned exactly once, here — never persisted, never recoverable.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { expiresInDays: { type: "integer", minimum: 1, maximum: 365 } } } } } },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { invite: { $ref: "#/components/schemas/ManagerInviteAdmin" }, inviteLink: { type: "string", format: "uri", example: "https://dominio.com/manager-invite/<64-char-hex-token>" } } }) } } },
          "403": errorResponse("Missing manager.manage permission"),
        },
      },
    },
    "/admin/manager/invites/pending-review": {
      get: {
        tags: ["Admin Manager"],
        summary: "Solicitações — accepted invites (USED + approvalStatus PENDING_REVIEW) awaiting an Admin verdict",
        description: "Requires `manager.read`. Comercial → Gerentes → Solicitações.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "array", items: { $ref: "#/components/schemas/ManagerInviteAdmin" } }) } } },
          "403": errorResponse("Missing manager.read permission"),
        },
      },
    },
    "/admin/manager/invites/{id}": {
      get: {
        tags: ["Admin Manager"],
        summary: "Full invite detail",
        description: "Requires `manager.read`. Never includes tokenHash.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerInviteAdmin" }) } } },
          "403": errorResponse("Missing manager.read permission"),
          "404": errorResponse("Not found"),
        },
      },
    },
    "/admin/manager/invites/{id}/regenerate": {
      post: {
        tags: ["Admin Manager"],
        summary: "Invalidate the current link and issue a new one",
        description: "Requires `manager.manage`. Refuses an already-USED invite.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { invite: { $ref: "#/components/schemas/ManagerInviteAdmin" }, inviteLink: { type: "string", format: "uri" } } }) } } },
          "403": errorResponse("Missing manager.manage permission"),
          "404": errorResponse("Not found"),
          "422": errorResponse("Invite already used"),
        },
      },
    },
    "/admin/manager/invites/{id}/revoke": {
      post: {
        tags: ["Admin Manager"],
        summary: "Permanently invalidate an invite",
        description: "Requires `manager.manage`. Refuses an already-USED invite.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerInviteAdmin" }) } } },
          "403": errorResponse("Missing manager.manage permission"),
          "404": errorResponse("Not found"),
          "422": errorResponse("Invite already used"),
        },
      },
    },
    "/admin/manager/invites/{id}/approve": {
      post: {
        tags: ["Admin Manager"],
        summary: "Approve a pending manager solicitation — decides the commission ceiling and promotes the account",
        description: "Requires `manager.manage`. Refinamento Fase 8. Only valid when the invite's approvalStatus is PENDING_REVIEW. Promotes the accepted User to role MANAGER, creates their ManagerProfile with `commissionPercent` as their maximum ceiling, generates their manager code, and unlocks /manager portal access immediately.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { commissionPercent: { type: "number", minimum: 0, maximum: 100, example: 70 } }, required: ["commissionPercent"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerProfile" }) } } },
          "403": errorResponse("Missing manager.manage permission"),
          "404": errorResponse("Not found"),
          "422": errorResponse("Invite is not awaiting approval"),
        },
      },
    },
    "/admin/manager/invites/{id}/reject": {
      post: {
        tags: ["Admin Manager"],
        summary: "Reject a pending manager solicitation",
        description: "Requires `manager.manage`. The underlying User account is left untouched — still a regular ACTIVE player, never promoted.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { reason: { type: "string", minLength: 3 } }, required: ["reason"] } } } },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ $ref: "#/components/schemas/ManagerInviteAdmin" }) } } },
          "403": errorResponse("Missing manager.manage permission"),
          "404": errorResponse("Not found"),
          "422": errorResponse("Invite is not awaiting approval"),
        },
      },
    },
    "/manager-invites/{token}": {
      get: {
        tags: ["Manager"],
        summary: "Public — resolve a raw invite token (the acceptance page's initial load)",
        description: "No auth. Rate-limited. Only confirms redeemability — the candidate's identity doesn't exist yet at this point (see Cadastro de Gerente decision), so no name/email is returned.",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { status: { type: "string" } } }) } } },
          "404": errorResponse("Invalid/expired/revoked token"),
        },
      },
    },
    "/manager-invites/{token}/accept": {
      post: {
        tags: ["Manager"],
        summary: "Public — the invited person supplies their identity and creates their account",
        description: "No auth (rate-limited). Cadastro de Gerente — this does NOT create a Manager. It creates a plain ACTIVE `USER` account from the submitted name/email/phone and moves the invite to approvalStatus PENDING_REVIEW, surfacing it in the Admin's Solicitações queue. Only the Admin's later approve step promotes the role.",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 2 },
                  email: { type: "string", format: "email" },
                  phone: { type: "string" },
                  password: { type: "string", minLength: 8, maxLength: 72 },
                  confirmPassword: { type: "string" },
                },
                required: ["name", "email", "password", "confirmPassword"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: dataEnvelope({ type: "object", properties: { approvalStatus: { type: "string", enum: ["PENDING_REVIEW"] } } }) } } },
          "400": errorResponse("Passwords don't match / weak password"),
          "404": errorResponse("Invalid token"),
          "422": errorResponse("Token already used/revoked/expired"),
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

      RegisterInput: {
        type: "object",
        description: "Player self-signup. username/email are auto-generated internally and never collected here — phone is the login identifier (see AuthService.login()).",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          phone: { type: "string", description: "Brazilian phone, any punctuation — normalized to digits-only" },
          password: { type: "string", minLength: 8, maxLength: 72 },
          cpf: { type: "string", description: "Required — the AmploPay gateway rejects PIX deposits without a payer CPF" },
          referralCode: { type: "string" },
        },
        required: ["firstName", "lastName", "phone", "password", "cpf"],
      },
      LoginInput: {
        type: "object",
        properties: {
          email: { type: "string", description: "A real email (staff/admin/manager), a Conta Demo login (e.g. \"demo47291\"), or a player's phone number" },
          password: { type: "string" },
          rememberMe: { type: "boolean", default: false },
        },
        required: ["email", "password"],
      },
      AdminCreateUserInput: {
        type: "object",
        description: "Admin-created accounts (backoffice /admin/users) still require a real username/email, unlike public player signup — see RegisterInput.",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          username: { type: "string", pattern: "^[a-z0-9_]{3,24}$" },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, maxLength: 72 },
          phone: { type: "string" },
          role: { $ref: "#/components/schemas/Role" },
          status: { $ref: "#/components/schemas/UserStatus" },
        },
        required: ["firstName", "lastName", "username", "email", "password"],
      },
      AdminUpdateUserInput: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          username: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string", nullable: true },
          avatar: { type: "string", nullable: true },
          cpf: { type: "string", nullable: true },
          dateOfBirth: { type: "string", format: "date-time", nullable: true },
          locale: { type: "string" },
          timezone: { type: "string" },
          role: { $ref: "#/components/schemas/Role" },
          status: { $ref: "#/components/schemas/UserStatus" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      Role: {
        type: "string",
        enum: ["SUPER_ADMIN", "ADMIN", "FINANCE", "OPERATOR", "MODERATOR", "SUPPORT", "COMPLIANCE", "AUDIT", "USER", "AFFILIATE"],
      },
      UserStatus: { type: "string", enum: ["ACTIVE", "PENDING", "BLOCKED", "SUSPENDED"] },
      User: {
        type: "object",
        description: "UserResponseDto — never includes passwordHash.",
        properties: {
          id: { type: "string", format: "uuid" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          fullName: { type: "string" },
          username: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string", nullable: true },
          avatar: { type: "string", nullable: true },
          cpf: { type: "string", nullable: true },
          dateOfBirth: { type: "string", format: "date-time", nullable: true },
          locale: { type: "string" },
          timezone: { type: "string" },
          status: { $ref: "#/components/schemas/UserStatus" },
          role: { $ref: "#/components/schemas/Role" },
          tags: { type: "array", items: { type: "string" } },
          lastLoginAt: { type: "string", format: "date-time", nullable: true },
          emailVerified: { type: "boolean" },
          phoneVerified: { type: "boolean" },
          mfaEnabled: { type: "boolean" },
          locked: { type: "boolean" },
          referralCode: { type: "string" },
          xp: { type: "integer" },
          level: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          deletedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      Session: {
        type: "object",
        description: "SessionResponseDto",
        properties: {
          id: { type: "string" },
          ip: { type: "string", nullable: true },
          os: { type: "string", nullable: true },
          browser: { type: "string", nullable: true },
          device: { type: "string", nullable: true },
          location: { type: "string", nullable: true },
          rememberMe: { type: "boolean" },
          active: { type: "boolean" },
          current: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          lastActivityAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time" },
          revokedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      AuditLog: {
        type: "object",
        description: "AuditLogResponseDto — append-only, never deletable.",
        properties: {
          id: { type: "string" },
          actorId: { type: "string", nullable: true },
          actorType: { type: "string", enum: ["USER", "SYSTEM"] },
          actorRole: { $ref: "#/components/schemas/Role" },
          action: { type: "string", example: "auth.login.success" },
          entityType: { type: "string" },
          entityId: { type: "string", nullable: true },
          before: {},
          after: {},
          ip: { type: "string", nullable: true },
          userAgent: { type: "string", nullable: true },
          sessionId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Permission: {
        type: "object",
        properties: { key: { type: "string", example: "users.read" }, description: { type: "string" } },
      },
      RolePermissions: {
        type: "object",
        properties: { role: { $ref: "#/components/schemas/Role" }, permissions: { type: "array", items: { type: "string" } } },
      },
      MfaStatus: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          featureAvailable: { type: "boolean" },
          methods: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["TOTP", "EMAIL", "SMS"] },
                enabled: { type: "boolean" },
                verifiedAt: { type: "string", format: "date-time", nullable: true },
              },
            },
          },
          recoveryCodesRemaining: { type: "integer" },
        },
      },

      MatchStatus: {
        type: "string",
        enum: ["CREATED", "AWAITING_START", "IN_PROGRESS", "GOAL_REACHED", "CASHOUT_AVAILABLE", "CASHED_OUT", "LOST", "CANCELLED", "INVALIDATED"],
        description: "See src/modules/match-engine/utils/match-state-machine.ts for the allowed transition table. No transition may occur outside it.",
      },
      MatchEventType: {
        type: "string",
        enum: ["CREATED", "STARTED", "PROGRESSED", "GOAL_REACHED", "CASHOUT_REQUESTED", "CASHOUT_APPROVED", "CASHOUT_DENIED", "COMPLETED", "LOST", "CANCELLED", "INVALIDATED"],
      },
      MatchCreated: {
        type: "object",
        description: "MatchCreatedResponseDto — the only response that ever carries the raw match token.",
        properties: {
          matchId: { type: "string", format: "uuid" },
          matchNumber: { type: "string", example: "HJ-A1B2C3D4" },
          token: { type: "string" },
          seed: { type: "string" },
          betAmount: { type: "integer", description: "Cents" },
          targetMultiplier: { type: "number" },
          goalAmount: { type: "integer", description: "Cents" },
          mode: { type: "string", enum: ["DEMO", "NORMAL", "HARD"] },
          configVersion: { type: "integer", nullable: true },
          engineParams: { type: "object", additionalProperties: true },
        },
      },
      MatchProgress: {
        type: "object",
        description: "MatchProgressResponseDto",
        properties: {
          matchId: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/MatchStatus" },
          platformsPassed: { type: "integer" },
          multiplier: { type: "number" },
          potentialPayout: { type: "integer", description: "Cents" },
          goalReached: { type: "boolean" },
          cashoutAvailable: { type: "boolean" },
        },
      },
      MatchProgressInput: {
        type: "object",
        properties: {
          token: { type: "string" },
          platformsPassed: { type: "integer", minimum: 0, maximum: 500 },
          collisionCount: { type: "integer", minimum: 0 },
          longestStreak: { type: "integer", minimum: 0 },
          avgSpeed: { type: "number", minimum: 0 },
          maxVerticalSpeed: { type: "number" },
        },
        required: ["token", "platformsPassed"],
      },
      MatchResolve: {
        type: "object",
        description: "MatchResolveResponseDto",
        properties: {
          matchId: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/MatchStatus" },
          multiplier: { type: "number" },
          payout: { type: "integer", description: "Cents" },
          balanceAfter: { type: "integer", nullable: true, description: "Cents" },
        },
      },
      MatchResolveInput: {
        type: "object",
        properties: {
          token: { type: "string" },
          action: { type: "string", enum: ["cashout", "loss", "forfeit"] },
          platformsPassed: { type: "integer", minimum: 0, maximum: 500 },
          collisionCount: { type: "integer", minimum: 0 },
          longestStreak: { type: "integer", minimum: 0 },
          avgSpeed: { type: "number", minimum: 0 },
          maxVerticalSpeed: { type: "number" },
        },
        required: ["token", "action", "platformsPassed"],
      },
      MatchSummary: {
        type: "object",
        description: "MatchSummaryDto — used by both the player's own history and the admin list.",
        properties: {
          id: { type: "string", format: "uuid" },
          matchNumber: { type: "string" },
          status: { $ref: "#/components/schemas/MatchStatus" },
          mode: { type: "string", enum: ["DEMO", "NORMAL", "HARD"] },
          betAmount: { type: "integer", description: "Cents" },
          multiplier: { type: "number" },
          payout: { type: "integer", nullable: true, description: "Cents" },
          platformsPassed: { type: "integer" },
          riskScore: { type: "number", description: "Anti-Cheat risk score, 0-100" },
          createdAt: { type: "string", format: "date-time" },
          resolvedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      MatchEvent: {
        type: "object",
        description: "MatchEventDto — one append-only timeline row per significant lifecycle event.",
        properties: {
          id: { type: "string" },
          type: { $ref: "#/components/schemas/MatchEventType" },
          payload: { type: "object", nullable: true, additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      MatchDetail: {
        type: "object",
        description: "MatchDetailDto — admin-only, full row. tokenHash is deliberately never included, even here.",
        properties: {
          id: { type: "string", format: "uuid" },
          matchNumber: { type: "string" },
          userId: { type: "string", format: "uuid" },
          betAmount: { type: "integer", description: "Cents" },
          status: { $ref: "#/components/schemas/MatchStatus" },
          platformsPassed: { type: "integer" },
          multiplier: { type: "number" },
          targetMultiplier: { type: "number" },
          goalAmount: { type: "integer", description: "Cents" },
          potentialPayout: { type: "integer", nullable: true, description: "Cents" },
          payout: { type: "integer", nullable: true, description: "Cents" },
          balanceBefore: { type: "integer", description: "Cents" },
          balanceAfter: { type: "integer", nullable: true, description: "Cents" },
          seed: { type: "string" },
          mode: { type: "string", enum: ["DEMO", "NORMAL", "HARD"] },
          configVersion: { type: "integer", nullable: true },
          presetKey: { type: "string", nullable: true },
          engineParams: { type: "object", nullable: true, additionalProperties: true },
          goalSnapshot: { type: "object", nullable: true, additionalProperties: true },
          antiCheatSnapshot: { type: "object", nullable: true, additionalProperties: true },
          durationSeconds: { type: "integer", nullable: true },
          longestStreak: { type: "integer" },
          collisionCount: { type: "integer" },
          avgSpeed: { type: "number", nullable: true },
          riskScore: { type: "number", description: "0-100" },
          invalidationReason: { type: "string", nullable: true },
          engineVersion: { type: "string", nullable: true },
          ip: { type: "string", nullable: true },
          userAgent: { type: "string", nullable: true },
          device: { type: "string", nullable: true },
          os: { type: "string", nullable: true },
          location: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          startedAt: { type: "string", format: "date-time", nullable: true },
          resolvedAt: { type: "string", format: "date-time", nullable: true },
          events: { type: "array", items: { $ref: "#/components/schemas/MatchEvent" } },
        },
      },

      WalletAccount: {
        type: "string",
        enum: ["MAIN", "LOCKED", "BONUS"],
        description: "Which of a wallet's 3 buckets a WalletTransaction moved — Saldo Principal/Bloqueado/Bônus.",
      },
      TransactionType: {
        type: "string",
        enum: [
          "BET", "BET_REFUND", "PAYOUT", "DEPOSIT", "DEPOSIT_PENDING", "DEPOSIT_FAILED",
          "WITHDRAW", "WITHDRAW_PENDING", "WITHDRAW_REJECTED", "WITHDRAW_APPROVED",
          "BONUS", "CASHBACK", "COMMISSION", "ADJUSTMENT", "REVERSAL", "SYSTEM",
          "MANUAL", "TRANSFER", "LOCK", "UNLOCK", "EXPIRATION",
        ],
      },
      TransactionStatus: { type: "string", enum: ["PENDING", "COMPLETED", "FAILED"] },
      WalletBalances: {
        type: "object",
        description: "WalletBalancesDto — the 3-bucket view every wallet read returns.",
        properties: {
          userId: { type: "string", format: "uuid" },
          main: { type: "integer", description: "Saldo Principal, cents" },
          locked: { type: "integer", description: "Saldo Bloqueado, cents" },
          bonus: { type: "integer", description: "Saldo Bônus, cents" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      WalletTransaction: {
        type: "object",
        description: "WalletTransactionDto — one row per wallet-side money movement. idempotencyKey is deliberately never included.",
        properties: {
          id: { type: "string", format: "uuid" },
          walletId: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          ledgerId: { type: "string", nullable: true, description: "Null only for rows that never moved money, e.g. DEPOSIT_PENDING." },
          type: { $ref: "#/components/schemas/TransactionType" },
          account: { $ref: "#/components/schemas/WalletAccount" },
          amount: { type: "integer", description: "Cents, always positive — direction is implied by `type`/`account`, not sign." },
          balanceBefore: { type: "integer", nullable: true, description: "Cents, for the `account` bucket specifically" },
          balanceAfter: { type: "integer", nullable: true, description: "Cents" },
          origin: { type: "string", example: "match-engine" },
          originId: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          status: { $ref: "#/components/schemas/TransactionStatus" },
          metadata: { type: "object", nullable: true, additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      WalletAdminSummary: {
        type: "object",
        description: "WalletAdminSummaryDto — Wallet joined with the owning user's display fields, for the admin list.",
        properties: {
          userId: { type: "string", format: "uuid" },
          userName: { type: "string" },
          userEmail: { type: "string", format: "email" },
          main: { type: "integer", description: "Cents" },
          locked: { type: "integer", description: "Cents" },
          bonus: { type: "integer", description: "Cents" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      LedgerEntry: {
        type: "object",
        description: "LedgerEntryDto — append-only double-entry row. No update/delete endpoint exists anywhere in the API.",
        properties: {
          id: { type: "string", format: "uuid" },
          transactionId: { type: "string", format: "uuid" },
          debitAccount: { type: "string", example: "PLATFORM" },
          creditAccount: { type: "string", example: "WALLET:9c1e...:MAIN" },
          amount: { type: "integer", description: "Cents" },
          currency: { type: "string", example: "BRL" },
          reference: { type: "string", nullable: true },
          referenceType: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      GatewayProvider: {
        type: "string",
        enum: ["MOCK", "CARTPANDA", "CARTWAVEHUB", "MERCADO_PAGO", "PAY4FUN", "BSPAY", "PAY2M", "OPENPIX", "OUTROS"],
        description: "Only MOCK is functionally implemented this phase — the rest resolve to NotImplementedProvider.",
      },
      GatewayHealthStatus: { type: "string", enum: ["ONLINE", "DEGRADED", "OFFLINE"] },
      DepositStatus: { type: "string", enum: ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED", "EXPIRED"] },
      WithdrawStatus: { type: "string", enum: ["PENDING", "PROCESSING", "APPROVED", "REJECTED", "FAILED", "CANCELLED"] },
      Deposit: {
        type: "object",
        description: "DepositDto — player-facing. The frontend never learns which gateway generated this.",
        properties: {
          id: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/DepositStatus" },
          amountCents: { type: "integer" },
          pixCode: { type: "string", nullable: true },
          qrCodeUrl: { type: "string", nullable: true },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          confirmedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      DepositAdmin: {
        type: "object",
        description: "DepositAdminDto — Deposit joined with the owning user and gateway display fields.",
        allOf: [
          { $ref: "#/components/schemas/Deposit" },
          {
            type: "object",
            properties: {
              userId: { type: "string", format: "uuid" },
              userName: { type: "string" },
              userEmail: { type: "string", format: "email" },
              gatewayCredentialId: { type: "string", format: "uuid" },
              gatewayName: { type: "string" },
              gatewayProvider: { $ref: "#/components/schemas/GatewayProvider" },
              providerTransactionId: { type: "string", nullable: true },
              failureReason: { type: "string", nullable: true },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        ],
      },
      WithdrawAdmin: {
        type: "object",
        description: "WithdrawAdminDto — pixKeyMasked only, the encrypted PIX key is never returned.",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          userName: { type: "string" },
          userEmail: { type: "string", format: "email" },
          amountCents: { type: "integer" },
          status: { $ref: "#/components/schemas/WithdrawStatus" },
          pixKeyMasked: { type: "string", example: "********0022" },
          pixKeyType: { type: "string", nullable: true },
          gatewayCredentialId: { type: "string", format: "uuid" },
          gatewayName: { type: "string" },
          gatewayProvider: { $ref: "#/components/schemas/GatewayProvider" },
          providerTransactionId: { type: "string", nullable: true },
          requestedAt: { type: "string", format: "date-time" },
          processedAt: { type: "string", format: "date-time", nullable: true },
          rejectionReason: { type: "string", nullable: true },
          failureReason: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      GatewayCredentialAdmin: {
        type: "object",
        description: "GatewayCredentialAdminDto — never includes credentialsEncrypted/webhookSecretEncrypted.",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          provider: { $ref: "#/components/schemas/GatewayProvider" },
          mode: { type: "string", enum: ["SANDBOX", "PRODUCTION"] },
          active: { type: "boolean" },
          priority: { type: "integer" },
          weight: { type: "integer" },
          timeoutMs: { type: "integer" },
          maxRetries: { type: "integer" },
          simulatedHealth: { allOf: [{ $ref: "#/components/schemas/GatewayHealthStatus" }], nullable: true },
          latestHealthStatus: { allOf: [{ $ref: "#/components/schemas/GatewayHealthStatus" }], nullable: true },
          latestHealthCheckedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PaymentWebhookAdmin: {
        type: "object",
        description: "PaymentWebhookAdminDto — one inbound gateway webhook delivery, append-only except for its processing-result fields.",
        properties: {
          id: { type: "string", format: "uuid" },
          gatewayCredentialId: { type: "string", format: "uuid" },
          provider: { $ref: "#/components/schemas/GatewayProvider" },
          relatedType: { type: "string", enum: ["DEPOSIT", "WITHDRAW"] },
          relatedId: { type: "string" },
          eventType: { type: "string", example: "deposit.paid" },
          status: { type: "string", enum: ["RECEIVED", "PROCESSED", "ERROR", "REPROCESSED"] },
          providerEventId: { type: "string", nullable: true },
          payloadHash: { type: "string" },
          payload: { type: "object", additionalProperties: true },
          responseStatus: { type: "integer", nullable: true },
          responseBody: { type: "object", nullable: true, additionalProperties: true },
          signatureValid: { type: "boolean" },
          errorMessage: { type: "string", nullable: true },
          receivedAt: { type: "string", format: "date-time" },
          processedAt: { type: "string", format: "date-time", nullable: true },
          reprocessedAt: { type: "string", format: "date-time", nullable: true },
          reprocessCount: { type: "integer" },
          processingMs: { type: "integer", nullable: true },
        },
      },
      GatewayLogAdmin: {
        type: "object",
        description: "GatewayLogAdminDto — requestSummary/responseSummary are always pre-sanitized, never contain a credential or secret.",
        properties: {
          id: { type: "string", format: "uuid" },
          gatewayCredentialId: { type: "string", format: "uuid", nullable: true },
          provider: { allOf: [{ $ref: "#/components/schemas/GatewayProvider" }], nullable: true },
          direction: { type: "string", enum: ["outbound", "inbound"] },
          endpoint: { type: "string" },
          method: { type: "string", nullable: true },
          requestSummary: { type: "object", nullable: true, additionalProperties: true },
          responseSummary: { type: "object", nullable: true, additionalProperties: true },
          statusCode: { type: "integer", nullable: true },
          durationMs: { type: "integer", nullable: true },
          success: { type: "boolean" },
          errorMessage: { type: "string", nullable: true },
          correlationId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      PaymentSettings: {
        type: "object",
        description: "PaymentSettingsDto — single global row (id \"global\").",
        properties: {
          id: { type: "string", example: "global" },
          defaultGatewayCredentialId: { type: "string", format: "uuid", nullable: true },
          routingMode: { type: "string", enum: ["SINGLE", "ROUND_ROBIN", "WEIGHTED", "FAILOVER"] },
          timeoutMs: { type: "integer" },
          maxRetries: { type: "integer" },
          pixExpirationMinutes: { type: "integer" },
          depositMinCents: { type: "integer" },
          depositMaxCents: { type: "integer" },
          withdrawMinCents: { type: "integer" },
          withdrawMaxCents: { type: "integer" },
          maxWebhookProcessingMs: { type: "integer" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AffiliateStatus: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "BLOCKED", "DOCUMENTS_REQUESTED"] },
      CommissionStatus: { type: "string", enum: ["LOCKED", "AVAILABLE", "REJECTED"] },
      CommissionSourceType: { type: "string", enum: ["REVSHARE_DEPOSIT", "CPA_FTD", "MANAGER_SPREAD"], description: "MANAGER_SPREAD (Refinamento Fase 8) is the Manager's cut — either their full ceiling (own platform link, no affiliate) or the remainder up to their ceiling above what a level-1 affiliate already earned." },
      AffiliateProfile: {
        type: "object",
        description: "AffiliateProfileDto — player-facing.",
        properties: {
          id: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/AffiliateStatus" },
          managerId: { type: "string", format: "uuid", nullable: true },
          requestedAt: { type: "string", format: "date-time" },
          approvedAt: { type: "string", format: "date-time", nullable: true },
          rejectionReason: { type: "string", nullable: true },
          blockedReason: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AffiliateProfileAdmin: {
        type: "object",
        description: "AffiliateProfileAdminDto — AffiliateProfile joined with the owning user and manager display fields.",
        allOf: [
          { $ref: "#/components/schemas/AffiliateProfile" },
          {
            type: "object",
            properties: {
              userId: { type: "string", format: "uuid" },
              userName: { type: "string" },
              userEmail: { type: "string", format: "email" },
              userPhone: { type: "string", nullable: true },
              managerName: { type: "string", nullable: true },
              approvedById: { type: "string", format: "uuid", nullable: true },
              blockedAt: { type: "string", format: "date-time", nullable: true },
              commissionPercent: { type: "number", nullable: true, description: "0-100, null = using the global/level default. Set by a Manager via PATCH /manager/network/{id}/commission — never above their own ceiling." },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        ],
      },
      AffiliateNetworkStats: {
        type: "object",
        description: "AffiliateNetworkStatsDto — AffiliateProfileAdmin plus the per-affiliate rollup shown in \"Minha Rede\", derived from Deposit/User/Commission (no new stored data). Deliberately has no house-margin/profit field — a Manager only ever sees their own network's numbers.",
        allOf: [
          { $ref: "#/components/schemas/AffiliateProfileAdmin" },
          {
            type: "object",
            properties: {
              playersReferredCount: { type: "integer", description: "Total users with User.referredById equal to this affiliate's userId — every direct signup, regardless of deposit status." },
              ftdCount: { type: "integer", description: "Count of CPA_FTD commission rows earned by this affiliate." },
              depositTotalCents: { type: "integer", description: "Sum of confirmed (PAID) deposits from this affiliate's direct referrals." },
              paidToAffiliateCents: { type: "integer", description: "REVSHARE_DEPOSIT + CPA_FTD credited to the affiliate themselves." },
              keptByManagerCents: { type: "integer", description: "MANAGER_SPREAD credited to the manager, tagged with this affiliateId." },
            },
          },
        ],
      },
      AffiliateLink: {
        type: "object",
        description: "AffiliateLinkDto — a thin analytics wrapper over the affiliate's one referral code, shared as /r/{referralCode}?l={slug}.",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
          clicks: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Commission: {
        type: "object",
        description: "CommissionDto — player-facing commission history row.",
        properties: {
          id: { type: "string", format: "uuid" },
          level: { type: "integer", minimum: 1, maximum: 3 },
          sourceType: { $ref: "#/components/schemas/CommissionSourceType" },
          amountCents: { type: "integer" },
          percentApplied: { type: "number", nullable: true },
          status: { $ref: "#/components/schemas/CommissionStatus" },
          createdAt: { type: "string", format: "date-time" },
          approvedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      CommissionAdmin: {
        type: "object",
        description: "CommissionAdminDto — Commission joined with affiliate/origin-player display fields.",
        allOf: [
          { $ref: "#/components/schemas/Commission" },
          {
            type: "object",
            properties: {
              affiliateId: { type: "string", format: "uuid", nullable: true, description: "Null for a MANAGER_SPREAD row with no affiliate in the path — affiliateName/affiliateEmail fall back to the manager (the payee) in that case." },
              affiliateName: { type: "string" },
              affiliateEmail: { type: "string", format: "email" },
              managerId: { type: "string", format: "uuid", nullable: true },
              originUserId: { type: "string", format: "uuid" },
              originUserName: { type: "string" },
              triggerId: { type: "string", description: "The originating Deposit id" },
              rejectionReason: { type: "string", nullable: true },
            },
          },
        ],
      },
      AffiliateSettings: {
        type: "object",
        description: "AffiliateSettingsDto — single global row (id \"global\").",
        properties: {
          id: { type: "string", example: "global" },
          revShareLevel1Percent: { type: "number", minimum: 0, maximum: 1 },
          revShareLevel2Percent: { type: "number", minimum: 0, maximum: 1 },
          revShareLevel3Percent: { type: "number", minimum: 0, maximum: 1 },
          cpaAmountCents: { type: "integer" },
          autoApproveCommissions: { type: "boolean" },
          requireManagerApprovalForAffiliates: { type: "boolean" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AffiliateDashboard: {
        type: "object",
        description: "Aggregated commission KPIs — built directly by the service from the Commission table, not from a single entity.",
        properties: {
          commissionTotalCents: { type: "integer" },
          commissionTodayCents: { type: "integer" },
          commission7dCents: { type: "integer" },
          commission30dCents: { type: "integer" },
          balanceAvailableCents: { type: "integer" },
          balanceLockedCents: { type: "integer" },
        },
      },
      ManagerProfile: {
        type: "object",
        description: "ManagerProfileDto — the caller's own manager record.",
        properties: {
          id: { type: "string", format: "uuid" },
          inviteCode: { type: "string", example: "KQEACY8P" },
          commissionPercent: { type: "number", description: "Maximum commission ceiling (0-100), decided by the Admin at invite-approval time.", example: 70 },
          status: { type: "string", enum: ["ACTIVE", "PENDING"] },
          inviteId: { type: "string", format: "uuid", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ManagerProfileAdmin: {
        type: "object",
        description: "ManagerProfileAdminDto — ManagerProfile joined with the owning user and network size.",
        allOf: [
          { $ref: "#/components/schemas/ManagerProfile" },
          {
            type: "object",
            properties: {
              userId: { type: "string", format: "uuid" },
              userName: { type: "string" },
              userEmail: { type: "string", format: "email" },
              userReferralCode: { type: "string", description: "Used to build the 'Meu Link da Plataforma' URL (/r/{code})." },
              affiliateCount: { type: "integer" },
              platformLinkClicks: { type: "integer" },
              inviteLinkClicks: { type: "integer" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        ],
      },
      ManagerInviteAdmin: {
        type: "object",
        description: "ManagerInviteAdminDto — never includes tokenHash. The raw, redeemable link only ever appears in the create/regenerate response. name/email/phone are null until the candidate redeems the invite (Cadastro de Gerente decision).",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", nullable: true },
          email: { type: "string", format: "email", nullable: true },
          phone: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          status: { type: "string", enum: ["ACTIVE", "EXPIRED", "REVOKED", "USED"] },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          createdById: { type: "string", format: "uuid" },
          createdByName: { type: "string" },
          acceptedAt: { type: "string", format: "date-time", nullable: true },
          acceptedByUserId: { type: "string", format: "uuid", nullable: true },
          acceptedIp: { type: "string", nullable: true },
          acceptedUserAgent: { type: "string", nullable: true },
          approvalStatus: { type: "string", enum: ["PENDING_REVIEW", "APPROVED", "REJECTED"], nullable: true, description: "Null until the invite is accepted." },
          approvedCommissionPercent: { type: "number", nullable: true },
          approvedAt: { type: "string", format: "date-time", nullable: true },
          approvedByName: { type: "string", nullable: true },
          rejectedAt: { type: "string", format: "date-time", nullable: true },
          rejectedByName: { type: "string", nullable: true },
          rejectionReason: { type: "string", nullable: true },
          revokedAt: { type: "string", format: "date-time", nullable: true },
          revokedById: { type: "string", format: "uuid", nullable: true },
          revokedByName: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ManagerLinkStats: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          clicks: { type: "integer" },
          signups: { type: "integer" },
          ftd: { type: "integer", description: "Absent on the invite link — FTD is a player-deposit concept." },
          conversionPercent: { type: "number" },
        },
      },
      ManagerLinks: {
        type: "object",
        description: "ManagerLinksDto — the two-link model (Refinamento Fase 8).",
        properties: {
          platformLink: { allOf: [{ $ref: "#/components/schemas/ManagerLinkStats" }], description: "/r/{referralCode} — captures players directly." },
          inviteLink: {
            allOf: [
              { $ref: "#/components/schemas/ManagerLinkStats" },
              { type: "object", properties: { code: { type: "string" } } },
            ],
            description: "/affiliate/invite/{inviteCode} — recruits affiliates only.",
          },
        },
      },
      ManagerDashboard: {
        type: "object",
        description: "Every field is derived from src/modules/affiliate's Commission table — never Wallet/Ledger. Split into paid-to-affiliates vs kept-by-manager per period rather than one blended total, since a blended total equals deposits × the manager's own ceiling and would let a Manager infer the house's own margin once combined with the deposit totals already visible in Minha Rede.",
        properties: {
          affiliatesActive: { type: "integer" },
          affiliatesPending: { type: "integer" },
          playersReferred: { type: "integer", description: "Deferred — currently always 0." },
          paidToAffiliatesTodayCents: { type: "integer" },
          keptByManagerTodayCents: { type: "integer" },
          paidToAffiliates7dCents: { type: "integer" },
          keptByManager7dCents: { type: "integer" },
          paidToAffiliates30dCents: { type: "integer" },
          keptByManager30dCents: { type: "integer" },
          paidToAffiliatesTotalCents: { type: "integer" },
          keptByManagerTotalCents: { type: "integer" },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "server/auth's access token — see src/server/auth/jwt.ts. Used by headless/mobile/server-to-server clients.",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "hj_access_token",
        description: "httpOnly access-token cookie — used by the same-origin player/admin web apps. See src/server/auth/cookies.ts.",
      },
    },
  },
} as const;
