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
    version: "0.3.0",
    description:
      "Backend foundation (Phase 2) + Identity module (Phase 3). Business-module endpoints (wallets, matches, affiliates, RTP, ...) are documented here as they land in later phases.",
  },
  servers: [{ url: "/api", description: "Same-origin" }],
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
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          username: { type: "string", pattern: "^[a-z0-9_]{3,24}$" },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, maxLength: 72 },
          referralCode: { type: "string" },
        },
        required: ["firstName", "lastName", "username", "email", "password"],
      },
      LoginInput: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
          rememberMe: { type: "boolean", default: false },
        },
        required: ["email", "password"],
      },
      AdminCreateUserInput: {
        allOf: [
          { $ref: "#/components/schemas/RegisterInput" },
          { type: "object", properties: { phone: { type: "string" }, role: { $ref: "#/components/schemas/Role" }, status: { $ref: "#/components/schemas/UserStatus" } } },
        ],
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
