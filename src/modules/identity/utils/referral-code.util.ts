import {
  REFERRAL_CODE_NAME_CHARS,
  REFERRAL_CODE_SUFFIX_CHARS,
} from "@/modules/identity/constants/identity.constants";

/**
 * Comprimento total de um código — mesma soma que `generateReferralCode`
 * produz (prefixo do nome + sufixo aleatório), para que um código neutro
 * seja visualmente indistinguível de um código normal.
 */
const NEUTRAL_CODE_LENGTH = REFERRAL_CODE_NAME_CHARS + REFERRAL_CODE_SUFFIX_CHARS;

/** Sem vogais minúsculas problemáticas nem 0/O/1/I — evita códigos ambíguos ao serem ditados ou digitados. */
const NEUTRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Código totalmente aleatório, sem nenhuma pista sobre o titular.
 *
 * Existe para as Contas Demo: `generateReferralCode` deriva o prefixo do
 * nome, e como toda Conta Demo era criada com o nome "Demo", os códigos
 * saíam como "DEMOK2JV" — anunciando na área "Indique e Ganhe" (e agora no
 * Perfil) que aquela conta é demonstrativa. Este gerador não olha para o
 * nome, então o código de uma Conta Demo fica indistinguível do de um
 * jogador comum.
 *
 * O guard contra o prefixo "DEMO" é defensivo: com este alfabeto a chance é
 * de ~1 em 1 milhão por código, mas o custo de reservar essa garantia é
 * desprezível e torna a propriedade verificável em vez de estatística.
 */
export function generateNeutralReferralCode(): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < NEUTRAL_CODE_LENGTH; i++) {
      code += NEUTRAL_CODE_ALPHABET[Math.floor(Math.random() * NEUTRAL_CODE_ALPHABET.length)];
    }
    if (!/^DEMO/i.test(code)) return code;
  }
  // Inalcançável na prática; mantém a função total em vez de devolver undefined.
  return `X${NEUTRAL_CODE_ALPHABET[Math.floor(Math.random() * NEUTRAL_CODE_ALPHABET.length)]}`.padEnd(
    NEUTRAL_CODE_LENGTH,
    "7"
  );
}

/** Deterministic-looking, human-shareable code — e.g. "RAFAE8K2Q" from "Rafael". */
export function generateReferralCode(name: string): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, REFERRAL_CODE_NAME_CHARS)
      .toUpperCase() || "PLAYER";
  const suffix = Math.random()
    .toString(36)
    .slice(2, 2 + REFERRAL_CODE_SUFFIX_CHARS)
    .toUpperCase();
  return `${base}${suffix}`;
}
