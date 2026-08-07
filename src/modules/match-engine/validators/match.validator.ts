import { z } from "zod";

export const createMatchSchema = z.object({ amount: z.number().positive() });
export type CreateMatchInput = z.infer<typeof createMatchSchema>;

/** Shared telemetry fields the client optionally reports — absence never itself counts as a violation, see AntiCheatService. */
const telemetryShape = {
  maxVerticalSpeed: z.number().optional(),
};

export const beginMatchSchema = z.object({
  token: z.string().min(32),
});
export type BeginMatchInput = z.infer<typeof beginMatchSchema>;

/** Periodic aggregate checkpoint — high-frequency events (platform passed, collision) are tallied client-side and reported here, not one call each. */
export const matchProgressSchema = z.object({
  token: z.string().min(32),
  platformsPassed: z.number().int().min(0).max(500),
  collisionCount: z.number().int().min(0).optional(),
  longestStreak: z.number().int().min(0).optional(),
  avgSpeed: z.number().min(0).optional(),
  ...telemetryShape,
});
export type MatchProgressInput = z.infer<typeof matchProgressSchema>;

export const matchResolveSchema = z.object({
  token: z.string().min(32),
  action: z.enum(["cashout", "loss", "forfeit"]),
  platformsPassed: z.number().int().min(0).max(500),
  collisionCount: z.number().int().min(0).optional(),
  longestStreak: z.number().int().min(0).optional(),
  avgSpeed: z.number().min(0).optional(),
  ...telemetryShape,
});
export type MatchResolveInput = z.infer<typeof matchResolveSchema>;

/** Pagination itself is parsed separately via src/server/http's parsePagination — this only covers the filter fields. */
export const adminMatchListQuerySchema = z.object({
  status: z.string().optional(),
  mode: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AdminMatchListQuery = z.infer<typeof adminMatchListQuerySchema>;
