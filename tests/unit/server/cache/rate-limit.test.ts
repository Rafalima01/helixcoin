import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ipFromRequest } from "@/server/cache/rate-limit";
import { env } from "@/server/config/env";

function reqWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/anything", { headers });
}

describe("ipFromRequest (A3: proxy-aware client IP resolution)", () => {
  it("ignores CF-Connecting-IP by default — Cloudflare doesn't front this deployment yet, so nothing strips a client-forged value", () => {
    expect(env.TRUSTED_CF_CONNECTING_IP).toBe(false);
    const req = reqWithHeaders({
      "cf-connecting-ip": "attacker-forged-value",
      "x-real-ip": "203.0.113.8",
      "x-forwarded-for": "1.2.3.4, 203.0.113.7",
    });
    expect(ipFromRequest(req)).toBe("203.0.113.8");
  });

  it("honors CF-Connecting-IP once TRUSTED_CF_CONNECTING_IP is explicitly enabled (Cloudflare confirmed in front)", () => {
    const original = env.TRUSTED_CF_CONNECTING_IP;
    env.TRUSTED_CF_CONNECTING_IP = true;
    try {
      const req = reqWithHeaders({
        "cf-connecting-ip": "203.0.113.9",
        "x-real-ip": "203.0.113.8",
        "x-forwarded-for": "1.2.3.4, 203.0.113.7",
      });
      expect(ipFromRequest(req)).toBe("203.0.113.9");
    } finally {
      env.TRUSTED_CF_CONNECTING_IP = original;
    }
  });

  it("falls back to X-Real-IP (set unconditionally by the documented Nginx config)", () => {
    const req = reqWithHeaders({
      "x-real-ip": "203.0.113.8",
      "x-forwarded-for": "1.2.3.4, 203.0.113.7",
    });
    expect(ipFromRequest(req)).toBe("203.0.113.8");
  });

  it("falls back to the LAST X-Forwarded-For entry (matches Nginx's $proxy_add_x_forwarded_for, which appends) — not the first, which an attacker fully controls", () => {
    const req = reqWithHeaders({
      "x-forwarded-for": "attacker-forged-value, 203.0.113.7",
    });
    expect(ipFromRequest(req)).toBe("203.0.113.7");
  });

  it("an attacker sending an arbitrary first XFF value cannot pick their own rate-limit bucket", () => {
    const real = "203.0.113.7";
    const attempt1 = reqWithHeaders({ "x-forwarded-for": `1.1.1.1, ${real}` });
    const attempt2 = reqWithHeaders({ "x-forwarded-for": `9.9.9.9, ${real}` });
    expect(ipFromRequest(attempt1)).toBe(real);
    expect(ipFromRequest(attempt2)).toBe(real);
  });

  it("falls back to \"unknown\" when no IP-bearing header is present", () => {
    const req = reqWithHeaders({});
    expect(ipFromRequest(req)).toBe("unknown");
  });
});
