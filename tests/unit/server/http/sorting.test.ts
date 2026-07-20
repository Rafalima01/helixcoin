import { describe, expect, it } from "vitest";
import { parseSort } from "@/server/http/sorting";

const ALLOWED = ["createdAt", "amount"] as const;

describe("parseSort", () => {
  it("falls back when no sort param is present", () => {
    expect(parseSort(new URLSearchParams(), ALLOWED, "createdAt")).toEqual({
      field: "createdAt",
      direction: "asc",
    });
  });

  it("accepts an allowed field", () => {
    expect(parseSort(new URLSearchParams("sort=amount"), ALLOWED, "createdAt").field).toBe(
      "amount"
    );
  });

  it("falls back to the default when the field is not in the allowlist — never passes an arbitrary client string through to a query", () => {
    const result = parseSort(new URLSearchParams("sort=userPasswordHash"), ALLOWED, "createdAt");
    expect(result.field).toBe("createdAt");
  });

  it("defaults direction to asc unless order=desc exactly", () => {
    expect(parseSort(new URLSearchParams("order=desc"), ALLOWED, "createdAt").direction).toBe(
      "desc"
    );
    expect(parseSort(new URLSearchParams("order=DESC"), ALLOWED, "createdAt").direction).toBe(
      "asc"
    );
  });
});
