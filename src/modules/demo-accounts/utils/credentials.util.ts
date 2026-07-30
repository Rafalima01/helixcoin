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
