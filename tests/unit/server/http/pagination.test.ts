import { describe, expect, it } from "vitest";
import { buildPaginationMeta, parsePagination } from "@/server/http/pagination";

describe("parsePagination", () => {
  it("defaults to page 1, pageSize 20", () => {
    const params = parsePagination(new URLSearchParams());
    expect(params).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 });
  });

  it("computes skip/take from page and pageSize", () => {
    const params = parsePagination(new URLSearchParams("page=3&pageSize=10"));
    expect(params).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 });
  });

  it("clamps pageSize to the 100 max", () => {
    expect(() => parsePagination(new URLSearchParams("pageSize=500"))).toThrow();
  });

  it("rejects page 0 (must be >= 1)", () => {
    expect(() => parsePagination(new URLSearchParams("page=0"))).toThrow();
  });
});

describe("buildPaginationMeta", () => {
  it("computes totalPages, rounding up", () => {
    const params = parsePagination(new URLSearchParams("page=1&pageSize=20"));
    expect(buildPaginationMeta(params, 45)).toEqual({
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("floors totalPages at 1 even when total is 0", () => {
    const params = parsePagination(new URLSearchParams());
    expect(buildPaginationMeta(params, 0).totalPages).toBe(1);
  });
});
