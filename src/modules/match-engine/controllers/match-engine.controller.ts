import type { NextRequest } from "next/server";
import { ok, created } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import { parseUserAgent } from "@/modules/identity/utils/user-agent.util";
import { matchEngineContainer } from "@/modules/match-engine/container";
import {
  createMatchSchema,
  beginMatchSchema,
  matchProgressSchema,
  matchResolveSchema,
} from "@/modules/match-engine/validators/match.validator";
import { toMatchSummaryDto } from "@/modules/match-engine/dto/match.dto";
import type {
  MatchCreatedResponseDto,
  MatchProgressResponseDto,
  MatchResolveResponseDto,
} from "@/modules/match-engine/dto/match.dto";
import type { Match } from "@/modules/match-engine/entities/match.entity";

const { matchEngineService } = matchEngineContainer;

function toCreatedDto(match: Match, token: string): MatchCreatedResponseDto {
  return {
    matchId: match.id,
    matchNumber: match.matchNumber,
    token,
    seed: match.seed,
    betAmount: match.betAmount,
    targetMultiplier: match.targetMultiplier,
    goalAmount: match.goalAmount,
    mode: match.mode,
    configVersion: match.configVersion,
    engineParams: match.engineParams ?? {},
  };
}

function toProgressDto(match: Match): MatchProgressResponseDto {
  return {
    matchId: match.id,
    status: match.status,
    platformsPassed: match.platformsPassed,
    multiplier: match.multiplier,
    potentialPayout: match.potentialPayout ?? 0,
    goalReached: match.status === "GOAL_REACHED" || match.status === "CASHOUT_AVAILABLE",
    cashoutAvailable: match.status === "CASHOUT_AVAILABLE",
  };
}

function toResolveDto(match: Match): MatchResolveResponseDto {
  return {
    matchId: match.id,
    status: match.status,
    multiplier: match.multiplier,
    payout: match.payout ?? 0,
    balanceAfter: match.balanceAfter,
  };
}

/**
 * Thin HTTP adapters — validate → call the service → shape the response. No
 * business logic here; see services/match-engine.service.ts for the actual
 * lifecycle/state-machine/anti-cheat handling.
 */
export async function handleCreateMatch(req: NextRequest, auth: AuthContext) {
  const body = createMatchSchema.parse(await req.json());
  const { ip, userAgent } = extractRequestMeta(req);
  const { device, os } = parseUserAgent(userAgent);
  const { match, token } = await matchEngineService.create(auth.userId, body, { ip, userAgent, device, os });
  return created(toCreatedDto(match, token));
}

export async function handleBeginMatch(req: NextRequest, auth: AuthContext, matchId: string) {
  const body = beginMatchSchema.parse(await req.json());
  const match = await matchEngineService.begin(matchId, auth.userId, body.token);
  return ok(toProgressDto(match));
}

export async function handleReportProgress(req: NextRequest, auth: AuthContext, matchId: string) {
  const body = matchProgressSchema.parse(await req.json());
  const match = await matchEngineService.reportProgress(matchId, auth.userId, body);
  return ok(toProgressDto(match));
}

export async function handleResolveMatch(req: NextRequest, auth: AuthContext, matchId: string) {
  const body = matchResolveSchema.parse(await req.json());
  const match = await matchEngineService.resolve(matchId, auth.userId, body);
  return ok(toResolveDto(match));
}

export async function handleListMyMatches(req: NextRequest, auth: AuthContext) {
  const url = req.nextUrl;
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 200));
  const items = await matchEngineService.listForUser(auth.userId, limit);
  return ok(items.map(toMatchSummaryDto));
}
