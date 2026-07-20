import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LocalStorageDriver, localStoragePath } from "@/server/uploads/local-storage.driver";

const testDir = resolve(process.cwd(), "./.vitest-uploads");

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("LocalStorageDriver", () => {
  const driver = new LocalStorageDriver();

  it("writes a file and returns a public-style URL", async () => {
    const result = await driver.upload({
      key: "test/hello.txt",
      buffer: Buffer.from("hello world"),
      contentType: "text/plain",
    });
    expect(result).toEqual({ key: "test/hello.txt", url: "/uploads/test/hello.txt" });

    const content = await driver.readForTest("test/hello.txt");
    expect(content.toString()).toBe("hello world");
  });

  it("creates nested directories as needed", async () => {
    await driver.upload({
      key: "a/b/c/deep.txt",
      buffer: Buffer.from("nested"),
      contentType: "text/plain",
    });
    expect((await driver.readForTest("a/b/c/deep.txt")).toString()).toBe("nested");
  });

  it("deletes a file", async () => {
    await driver.upload({
      key: "to-delete.txt",
      buffer: Buffer.from("x"),
      contentType: "text/plain",
    });
    await driver.delete("to-delete.txt");
    await expect(driver.readForTest("to-delete.txt")).rejects.toThrow();
  });

  it("rejects a path-traversal key", async () => {
    await expect(
      driver.upload({
        key: "../../etc/passwd",
        buffer: Buffer.from("x"),
        contentType: "text/plain",
      })
    ).rejects.toThrow();
  });

  it("getSignedUrl returns the same public path (no real signing for local disk)", async () => {
    await driver.upload({ key: "signed.txt", buffer: Buffer.from("x"), contentType: "text/plain" });
    await expect(driver.getSignedUrl("signed.txt")).resolves.toBe("/uploads/signed.txt");
  });

  it("localStoragePath resolves under the configured base dir", () => {
    expect(localStoragePath("foo/bar.txt")).toBe(resolve(testDir, "foo/bar.txt"));
  });
});
