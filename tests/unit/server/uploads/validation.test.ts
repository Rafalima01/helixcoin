import { describe, expect, it } from "vitest";
import { validateFile, DEFAULT_IMAGE_RULES } from "@/server/uploads/validation";
import { ValidationError } from "@/server/errors";

describe("validateFile", () => {
  it("accepts a valid image within the size limit", () => {
    expect(() =>
      validateFile({ size: 1024, contentType: "image/png" }, DEFAULT_IMAGE_RULES)
    ).not.toThrow();
  });

  it("rejects a zero-byte file", () => {
    expect(() => validateFile({ size: 0, contentType: "image/png" }, DEFAULT_IMAGE_RULES)).toThrow(
      ValidationError
    );
  });

  it("rejects a file over the size limit", () => {
    expect(() =>
      validateFile(
        { size: DEFAULT_IMAGE_RULES.maxSizeBytes + 1, contentType: "image/png" },
        DEFAULT_IMAGE_RULES
      )
    ).toThrow(ValidationError);
  });

  it("rejects a disallowed mime type", () => {
    expect(() =>
      validateFile({ size: 1024, contentType: "application/x-msdownload" }, DEFAULT_IMAGE_RULES)
    ).toThrow(ValidationError);
  });
});
