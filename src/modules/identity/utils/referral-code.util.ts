import {
  REFERRAL_CODE_NAME_CHARS,
  REFERRAL_CODE_SUFFIX_CHARS,
} from "@/modules/identity/constants/identity.constants";

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
