import { describe, expect, it } from "vitest";
import { generateCsrfToken, verifyCsrfToken } from "@/server/security/csrf";

describe("generateCsrfToken", () => {
  it("generates a 64-char hex token", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different token each call", () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });
});

describe("verifyCsrfToken", () => {
  it("accepts matching tokens", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token, token)).toBe(true);
  });

  it("rejects mismatched tokens", () => {
    expect(verifyCsrfToken(generateCsrfToken(), generateCsrfToken())).toBe(false);
  });

  it("rejects when either side is missing", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(undefined, token)).toBe(false);
    expect(verifyCsrfToken(token, undefined)).toBe(false);
    expect(verifyCsrfToken(undefined, undefined)).toBe(false);
  });

  it("rejects tokens of different lengths without throwing", () => {
    expect(verifyCsrfToken("short", generateCsrfToken())).toBe(false);
  });
});
