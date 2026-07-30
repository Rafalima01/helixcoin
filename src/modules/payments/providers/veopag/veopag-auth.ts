import { redis } from "@/server/cache/redis";
import { ExternalServiceError, UnauthorizedError } from "@/server/errors";

export const VEOPAG_BASE_URL = "https://api.veopag.com";

/**
 * VeoPag's own docs: the JWT is valid 1h and MUST be reused — calling
 * /api/auth/login on every request blows through their rate limit (25
 * attempts/15min per IP). `ProviderFactory.create()` instantiates a fresh
 * VeoPagProvider on every call (see that file's doc comment), so the cache
 * has to live outside the instance — Redis, shared across every
 * app/worker/ws process, exactly as VeoPag's own integration guide
 * recommends for multi-process backends.
 */
const TOKEN_TTL_SECONDS = 55 * 60;
const tokenCacheKey = (credentialId: string) => `veopag:token:${credentialId}`;

interface VeoPagLoginResponse {
  token: string;
}

async function login(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${VEOPAG_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new UnauthorizedError("VeoPag: client_id/client_secret inválidos");
  }
  if (!res.ok) {
    throw new ExternalServiceError("VEOPAG", `login falhou (HTTP ${res.status})`);
  }

  const json = (await res.json()) as VeoPagLoginResponse;
  return json.token;
}

/** Returns a cached token when available, otherwise logs in and caches the result. */
export async function getVeoPagToken(credentialId: string, clientId: string, clientSecret: string): Promise<string> {
  const cached = await redis.get(tokenCacheKey(credentialId));
  if (cached) return cached;

  const token = await login(clientId, clientSecret);
  await redis.set(tokenCacheKey(credentialId), token, "EX", TOKEN_TTL_SECONDS);
  return token;
}

/** Called after a 401 from an authenticated VeoPag call — forces the next getVeoPagToken to log in again instead of reusing a revoked/stale token. */
export async function invalidateVeoPagToken(credentialId: string): Promise<void> {
  await redis.del(tokenCacheKey(credentialId));
}
