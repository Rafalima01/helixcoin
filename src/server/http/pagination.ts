import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface PaginationParams {
  page: number;
  pageSize: number;
  /** Ready to spread into a Prisma `findMany` call: `{ skip, take }`. */
  skip: number;
  take: number;
}

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const { page, pageSize } = paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function buildPaginationMeta(params: PaginationParams, total: number): PaginationMeta {
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
