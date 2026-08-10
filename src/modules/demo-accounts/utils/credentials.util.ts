/** e.g. "demo47291" — uniqueness is the CALLER's responsibility (DemoAccountService.create retries on collision, same pattern as generateReferralCode). */
export function generateDemoLogin(): string {
  const digits = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
  return `demo${digits}`;
}

/**
 * Fixed password for every Conta Demo the Admin creates — intentional, not a
 * placeholder. Contas Demo are handed out to influencers/partners who need a
 * memorable, repeatable credential; DemoAccountService.create hashes this
 * with the same hashPassword() every real account uses, so the plaintext is
 * never persisted. Safe to reuse across every demo account because login
 * (AuthService.login) always looks the user up by phone FIRST, then compares
 * the hash for that specific row — knowing this password never grants access
 * without also knowing that account's phone number. Never read by the real
 * player registration/password-reset flow, which still hashes a
 * user-supplied password exactly as before.
 */
export const DEMO_ACCOUNT_DEFAULT_PASSWORD = "demo@123";

/** No dedicated inbox exists for demo accounts — a synthetic address just satisfies User.email's unique/NOT NULL constraint. */
export function demoEmailFor(login: string): string {
  return `${login}@demo.helixcoin.internal`;
}

/**
 * A synthetic-but-`isValidBrazilianPhone`-valid mobile number for admin-created
 * demo accounts. Since phone+senha is the login identifier on every zone (see
 * AuthService.login), a Conta Demo with no phone can never authenticate — this
 * fills the same role generateDemoLogin() used to play before login stopped
 * accepting a bare username. Uniqueness is the CALLER's responsibility, same
 * retry-on-collision pattern as generateDemoLogin/generateReferralCode.
 */
export function generateDemoPhone(): string {
  const ddd = 11 + Math.floor(Math.random() * 89); // 11-99 — the full range isValidBrazilianPhone accepts
  const rest = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
  return `${ddd}9${rest}`; // 11 digits, mobile shape: DDD + required "9" + 8 digits
}
