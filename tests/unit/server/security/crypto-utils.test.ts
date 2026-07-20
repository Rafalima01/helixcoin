import { describe, expect, it } from "vitest";
import { decrypt, encrypt, sha256Hex } from "@/server/security/crypto-utils";

describe("encrypt/decrypt", () => {
  it("round-trips plaintext", () => {
    const ciphertext = encrypt("11144477735"); // e.g. a CPF
    expect(ciphertext).not.toContain("11144477735");
    expect(decrypt(ciphertext)).toBe("11144477735");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same input");
    const b = encrypt("same input");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same input");
    expect(decrypt(b)).toBe("same input");
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    const ciphertext = encrypt("secret");
    const [iv, authTag, body] = ciphertext.split(":");
    const tamperedBody = Buffer.from(body, "base64");
    tamperedBody[0] ^= 0xff;
    const tampered = [iv, authTag, tamperedBody.toString("base64")].join(":");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on a malformed payload", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow();
  });
});

describe("sha256Hex", () => {
  it("is deterministic", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
  });

  it("matches the known SHA-256 of the empty string", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
