/**
 * O nome exibido de uma Conta Demo é o mesmo `User.firstName`/`User.lastName`
 * de qualquer jogador — não existe (nem foi criada) coluna própria de nome
 * para contas demo. O backoffice, porém, trata isso como UM campo só ("Nome
 * da conta": "Influenciador João", "Teste Instagram"), então estas duas
 * funções são a tradução entre as duas visões.
 *
 * `DemoAccountRow.fullName` é montado como `${firstName} ${lastName}`.trim()
 * (ver demo-account.prisma-repository.ts), e é exatamente o que
 * `joinDisplayName` reproduz — logo o par split/join é um round-trip fiel:
 * o que o admin digita é o que ele lê de volta, com ou sem sobrenome.
 */

export const DEMO_ACCOUNT_NAME_MAX_LENGTH = 60;

/** Nome padrão de uma Conta Demo criada sem nome informado — o comportamento que existia antes desta funcionalidade. */
export const DEMO_ACCOUNT_DEFAULT_NAME = "Conta Demo";

/**
 * Quebra no PRIMEIRO espaço: tudo antes vira `firstName`, todo o resto vira
 * `lastName` (possivelmente vazio). Espaços internos repetidos são
 * colapsados para que o round-trip seja exato.
 */
export function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const normalized = name.trim().replace(/\s+/g, " ");
  const separator = normalized.indexOf(" ");
  if (separator === -1) return { firstName: normalized, lastName: "" };
  return {
    firstName: normalized.slice(0, separator),
    lastName: normalized.slice(separator + 1),
  };
}

/** Inverso de `splitDisplayName` — mesma regra que o repositório usa para montar `fullName`. */
export function joinDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
