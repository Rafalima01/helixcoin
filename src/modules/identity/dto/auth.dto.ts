export interface RegisterInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  referralCode?: string;
  /** Phase 8 — optional AffiliateLink slug from `/r/{code}?l={slug}`, analytics-only. */
  affiliateLinkSlug?: string;
  /** Fase Demo — "demo" when signup came from the ?source=demo flow (see promotions.service.ts). */
  source?: "demo";
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/** What login/register/refresh return alongside the Set-Cookie headers — tokens themselves never appear in the JSON body. */
export interface AuthResultDto {
  user: import("@/modules/identity/dto/user.dto").UserResponseDto;
}
