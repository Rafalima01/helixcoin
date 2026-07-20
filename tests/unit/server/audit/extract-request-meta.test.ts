import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { extractRequestMeta } from "@/server/audit/audit.service";

describe("extractRequestMeta", () => {
  it("reads the first IP out of a comma-separated x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1", "user-agent": "vitest" },
    });
    expect(extractRequestMeta(req)).toEqual({ ip: "203.0.113.1", userAgent: "vitest" });
  });

  it("returns nulls when the headers are absent", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(extractRequestMeta(req)).toEqual({ ip: null, userAgent: null });
  });
});
