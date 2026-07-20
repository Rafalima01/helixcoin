import { ValidationError } from "@/server/errors";

export interface FileValidationRules {
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
}

/** Sensible defaults for document-style uploads (KYC, receipts) — override per call site. */
export const DEFAULT_DOCUMENT_RULES: FileValidationRules = {
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
};

export const DEFAULT_IMAGE_RULES: FileValidationRules = {
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
};

export function validateFile(
  input: { size: number; contentType: string },
  rules: FileValidationRules
): void {
  if (input.size <= 0) {
    throw new ValidationError("File is empty");
  }
  if (input.size > rules.maxSizeBytes) {
    throw new ValidationError(
      `File exceeds the maximum allowed size of ${Math.round(rules.maxSizeBytes / 1024 / 1024)}MB`
    );
  }
  if (!rules.allowedMimeTypes.includes(input.contentType)) {
    throw new ValidationError(
      `File type "${input.contentType}" is not allowed. Accepted: ${rules.allowedMimeTypes.join(", ")}`
    );
  }
}
