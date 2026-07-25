import { randomBytes } from "node:crypto";

/** Short, human-shareable, NON-sequential code — deliberately not an incrementing counter (see schema.prisma's file-level convention on never leaking row count/order through an identifier). */
export function generateMatchNumber(): string {
  return `HJ-${randomBytes(4).toString("hex").toUpperCase()}`;
}
