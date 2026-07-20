export type SortDirection = "asc" | "desc";

export interface SortParams<F extends string> {
  field: F;
  direction: SortDirection;
}

/**
 * Parses `?sort=field&order=asc|desc`, validating `field` against an
 * allowlist. The allowlist is what makes this safe to feed straight into a
 * Prisma `orderBy` — an arbitrary client-supplied field name never reaches
 * the query.
 */
export function parseSort<F extends string>(
  searchParams: URLSearchParams,
  allowedFields: readonly F[],
  fallback: F
): SortParams<F> {
  const requested = searchParams.get("sort");
  const field = allowedFields.includes(requested as F) ? (requested as F) : fallback;
  const direction: SortDirection = searchParams.get("order") === "desc" ? "desc" : "asc";
  return { field, direction };
}
