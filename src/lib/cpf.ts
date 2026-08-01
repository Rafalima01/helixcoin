/** Strips everything but digits — the only format sent to gateways (e.g. AmploPay's `client.document`) and stored in User.cpf. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Real check-digit validation (Receita Federal's mod-11 algorithm), not just
 * length/format — a well-formed but fake CPF (e.g. "111.111.111-11") would
 * otherwise pass format checks and only fail later at the payment gateway.
 */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}
