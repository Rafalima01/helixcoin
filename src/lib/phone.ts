import { onlyDigits } from "@/lib/cpf";

export { onlyDigits };

/** Loose but real validation: 10 digits (landline) or 11 (mobile, 9th digit must be "9"), DDD between 11-99. */
export function isValidBrazilianPhone(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 10 && digits.length !== 11) return false;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== "9") return false;

  return true;
}

/** Progressive display formatting as the user types — e.g. "11912345678" -> "(11) 91234-5678". */
export function formatPhone(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;

  const splitAt = digits.length <= 10 ? 4 : 5;
  return `(${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`;
}
