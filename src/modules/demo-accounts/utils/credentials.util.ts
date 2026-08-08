const SYMBOL_CHARS = "!@#$%&*";
const UPPER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no O/I — avoids visual ambiguity when read aloud/copied
const LOWER_CHARS = "abcdefghjkmnpqrstuvwxyz";
const DIGIT_CHARS = "23456789";

function randomChar(charset: string): string {
  return charset[Math.floor(Math.random() * charset.length)];
}

/** e.g. "demo47291" — uniqueness is the CALLER's responsibility (DemoAccountService.create retries on collision, same pattern as generateReferralCode). */
export function generateDemoLogin(): string {
  const digits = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
  return `demo${digits}`;
}

/** e.g. "Lx92@Pm83" — 9 chars, always includes upper+lower+digit+symbol, then shuffled (Fisher-Yates). */
export function generateDemoPassword(): string {
  const required = [
    randomChar(UPPER_CHARS),
    randomChar(LOWER_CHARS),
    randomChar(DIGIT_CHARS),
    randomChar(SYMBOL_CHARS),
  ];
  const fillerCharset = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS;
  const filler = Array.from({ length: 5 }, () => randomChar(fillerCharset));
  const chars = [...required, ...filler];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

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
