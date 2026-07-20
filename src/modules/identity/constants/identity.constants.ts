import { env } from "@/server/config/env";

/** Failed logins allowed before a temporary lock kicks in. */
export const MAX_LOGIN_ATTEMPTS = 5;
/** How long a temporary lock lasts once MAX_LOGIN_ATTEMPTS is hit. */
export const LOCKOUT_DURATION_MINUTES = 15;

/** Refresh-token lifetime without "remember me" — matches a short-lived browser session. */
export const SESSION_TTL_DEFAULT = "1d";
/** Refresh-token lifetime with "remember me" checked. */
export const SESSION_TTL_REMEMBER_ME = "30d";

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
export const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;

/** Auto-generated referral code shape: 5 letters from the name + 4 random alphanumeric. */
export const REFERRAL_CODE_NAME_CHARS = 5;
export const REFERRAL_CODE_SUFFIX_CHARS = 4;

/**
 * "Proteção contra sessão duplicada (configurável)" — when false, a new
 * login revokes every other active session for that user first. Sourced
 * from env (AUTH_ALLOW_CONCURRENT_SESSIONS) so ops can flip it without a
 * deploy; defaults to true.
 */
export function allowConcurrentSessions(): boolean {
  return env.AUTH_ALLOW_CONCURRENT_SESSIONS;
}
