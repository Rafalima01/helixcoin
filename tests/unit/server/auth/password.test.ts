import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("hashes a password to a non-plaintext bcrypt string", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("verifies the correct password against its hash", async () => {
    const hash = await hashPassword("s3cr3t!");
    await expect(verifyPassword("s3cr3t!", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3cr3t!");
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [a, b] = await Promise.all([hashPassword("same-input"), hashPassword("same-input")]);
    expect(a).not.toBe(b);
  });
});
