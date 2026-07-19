import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatMultiplier(value: number) {
  return `${value.toFixed(2)}x`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value);
}
