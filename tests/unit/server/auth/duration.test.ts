import { describe, expect, it } from "vitest";
import { parseDurationSeconds } from "@/server/auth/tokens";

describe("parseDurationSeconds", () => {
  it("parses seconds/minutes/hours/days", () => {
    expect(parseDurationSeconds("45s")).toBe(45);
    expect(parseDurationSeconds("15m")).toBe(15 * 60);
    expect(parseDurationSeconds("2h")).toBe(2 * 3600);
    expect(parseDurationSeconds("30d")).toBe(30 * 86400);
  });

  it("tolerates surrounding whitespace and internal spacing", () => {
    expect(parseDurationSeconds(" 15m ")).toBe(900);
    expect(parseDurationSeconds("15 m")).toBe(900);
  });

  it("throws on an unrecognized format", () => {
    expect(() => parseDurationSeconds("15")).toThrow();
    expect(() => parseDurationSeconds("15 minutes")).toThrow();
    expect(() => parseDurationSeconds("")).toThrow();
  });
});
