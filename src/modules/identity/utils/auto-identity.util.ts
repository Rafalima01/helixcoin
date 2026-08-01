const LOGIN_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // no o/0/i/1 — avoids visual ambiguity if ever surfaced (e.g. admin search)

function randomChar(charset: string): string {
  return charset[Math.floor(Math.random() * charset.length)];
}

/**
 * Player signup no longer collects username/email (phone + password is the
 * login identifier — see AuthService.login()) but `User.username`/`.email`
 * are still required+unique columns, so both are auto-generated and never
 * shown to the player. Uniqueness is the CALLER's responsibility, same
 * retry-on-collision pattern as generateReferralCode/generateDemoLogin.
 */
export function generateAutoUsername(): string {
  const suffix = Array.from({ length: 10 }, () => randomChar(LOGIN_CHARS)).join("");
  return `player_${suffix}`;
}

/** No dedicated inbox exists for phone-only signups — a synthetic address just satisfies User.email's unique/NOT NULL constraint, same convention as demo-accounts' demoEmailFor(). */
export function autoEmailFor(username: string): string {
  return `${username}@player.helixcoin.internal`;
}
