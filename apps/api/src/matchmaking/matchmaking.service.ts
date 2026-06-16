import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  GameMode,
  MatchFormat,
  MatchHistoryItem,
  MatchResultRequest,
  MatchResultResponse,
  PlayerMmrResponse,
  QueueJoinRequest,
  QueueStatusResponse,
  RankConfig
} from "@gamedash/contracts";
import { REGION_CLUSTERS } from "@gamedash/contracts";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EconomyService } from "../economy/economy.service";
import { ProgressionService } from "../progression/progression.service";
import { PrismaService } from "../prisma/prisma.service";

type PlayerState = QueueStatusResponse["state"];
type MatchOutcome = "win" | "loss" | "draw";

interface QueueEntry {
  playerId: string;
  mode: GameMode;
  format: MatchFormat;
  queuedAt: string;
  region?: string;
}

interface PlayerStatus {
  state: PlayerState;
  mode?: GameMode;
  format?: MatchFormat;
  team?: 1 | 2;
  matchId?: string;
  queuedAt?: string;
  opponentPlayerId?: string;
  teammateIds?: string[];
}

const GAME_MODES: GameMode[] = ["ranked", "unranked", "fun"];

const RANK_CONFIGS: RankConfig[] = [
  // ── Bronze (foundation: 0–1199) ──────────────────────────────────────────
  { mode: "ranked", minMmr: 0,    maxMmr: 999,  rank: "Bronze III",    sortOrder: 10 },
  { mode: "ranked", minMmr: 1000, maxMmr: 1099, rank: "Bronze II",     sortOrder: 20 },
  { mode: "ranked", minMmr: 1100, maxMmr: 1199, rank: "Bronze I",      sortOrder: 30 },
  // ── Silver (1200–1699) ───────────────────────────────────────────────────
  { mode: "ranked", minMmr: 1200, maxMmr: 1299, rank: "Silver V",      sortOrder: 40 },
  { mode: "ranked", minMmr: 1300, maxMmr: 1399, rank: "Silver IV",     sortOrder: 50 },
  { mode: "ranked", minMmr: 1400, maxMmr: 1499, rank: "Silver III",    sortOrder: 60 },
  { mode: "ranked", minMmr: 1500, maxMmr: 1599, rank: "Silver II",     sortOrder: 70 },
  { mode: "ranked", minMmr: 1600, maxMmr: 1699, rank: "Silver I",      sortOrder: 80 },
  // ── Gold (1700–2199) ─────────────────────────────────────────────────────
  { mode: "ranked", minMmr: 1700, maxMmr: 1799, rank: "Gold V",        sortOrder: 90 },
  { mode: "ranked", minMmr: 1800, maxMmr: 1899, rank: "Gold IV",       sortOrder: 100 },
  { mode: "ranked", minMmr: 1900, maxMmr: 1999, rank: "Gold III",      sortOrder: 110 },
  { mode: "ranked", minMmr: 2000, maxMmr: 2099, rank: "Gold II",       sortOrder: 120 },
  { mode: "ranked", minMmr: 2100, maxMmr: 2199, rank: "Gold I",        sortOrder: 130 },
  // ── Platinum (2200–2699) ─────────────────────────────────────────────────
  { mode: "ranked", minMmr: 2200, maxMmr: 2299, rank: "Platinum V",    sortOrder: 140 },
  { mode: "ranked", minMmr: 2300, maxMmr: 2399, rank: "Platinum IV",   sortOrder: 150 },
  { mode: "ranked", minMmr: 2400, maxMmr: 2499, rank: "Platinum III",  sortOrder: 160 },
  { mode: "ranked", minMmr: 2500, maxMmr: 2599, rank: "Platinum II",   sortOrder: 170 },
  { mode: "ranked", minMmr: 2600, maxMmr: 2699, rank: "Platinum I",    sortOrder: 180 },
  // ── Diamond (2700–3199) ──────────────────────────────────────────────────
  { mode: "ranked", minMmr: 2700, maxMmr: 2799, rank: "Diamond V",     sortOrder: 190 },
  { mode: "ranked", minMmr: 2800, maxMmr: 2899, rank: "Diamond IV",    sortOrder: 200 },
  { mode: "ranked", minMmr: 2900, maxMmr: 2999, rank: "Diamond III",   sortOrder: 210 },
  { mode: "ranked", minMmr: 3000, maxMmr: 3099, rank: "Diamond II",    sortOrder: 220 },
  { mode: "ranked", minMmr: 3100, maxMmr: 3199, rank: "Diamond I",     sortOrder: 230 },
  // ── Elite (3200+) ────────────────────────────────────────────────────────
  { mode: "ranked", minMmr: 3200, maxMmr: 3699, rank: "Master",        sortOrder: 240 },
  { mode: "ranked", minMmr: 3700, maxMmr: 4199, rank: "Grandmaster",   sortOrder: 250 },
  { mode: "ranked", minMmr: 4200,               rank: "Challenger",    sortOrder: 260 },
  // ── Other modes ──────────────────────────────────────────────────────────
  { mode: "unranked", minMmr: 0, rank: "UNRANKED", sortOrder: 10 },
  { mode: "fun",      minMmr: 0, rank: "CASUAL",   sortOrder: 10 }
];

const MMR_DELTAS: Record<GameMode, { win: number; loss: number }> = {
  ranked: { win: 32, loss: -24 },
  unranked: { win: 10, loss: -8 },
  fun: { win: 5, loss: -4 }
};

const PLACEMENT_MMR = 1000;
const DEFAULT_MATCH_DURATION_SECONDS = 15;
const DEFAULT_MAX_MMR_GAP = 400;

@Injectable()
export class MatchmakingService implements OnModuleInit {
  /** In-memory queue — intentionally ephemeral (real-time matching). Key = "${mode}-${format}". */
  private readonly queues = new Map<string, QueueEntry[]>();
  private readonly statuses = new Map<string, PlayerStatus>();
  private readonly matchTimers = new Map<string, NodeJS.Timeout>();
  /** Live rank config cache — seeded from DB, refreshed on CRUD. */
  private cachedRanks: RankConfig[] = [...RANK_CONFIGS];
  private cachedMaxMmrGap = DEFAULT_MAX_MMR_GAP;
  private cachedMatchDurationSeconds = DEFAULT_MATCH_DURATION_SECONDS;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgressionService) private readonly progressionService: ProgressionService,
    @Inject(EconomyService) private readonly economyService: EconomyService
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.prisma.rankConfig.count();
    if (count === 0) {
      await this.prisma.rankConfig.createMany({
        data: RANK_CONFIGS.map((r) => ({
          mode: r.mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN",
          minMmr: r.minMmr,
          maxMmr: r.maxMmr ?? null,
          rank: r.rank,
          sortOrder: r.sortOrder
        }))
      });
    }
    await this.reloadRankConfigs();
    await this.reloadMatchmakingSettings();
  }

  async reloadMatchmakingSettings(): Promise<void> {
    const row = await this.prisma.studioSetting.findUnique({ where: { key: "matchmaking" } });
    if (row?.value) {
      const val = row.value as { maxMmrGap?: number; matchDurationSeconds?: number };
      if (typeof val.maxMmrGap === "number") this.cachedMaxMmrGap = val.maxMmrGap;
      if (typeof val.matchDurationSeconds === "number" && val.matchDurationSeconds > 0) {
        this.cachedMatchDurationSeconds = val.matchDurationSeconds;
      }
    }
  }

  async reloadRankConfigs(): Promise<void> {
    const rows = await this.prisma.rankConfig.findMany({ orderBy: { sortOrder: "asc" } });
    this.cachedRanks = rows.map((r) => ({
      mode: r.mode.toLowerCase() as GameMode,
      minMmr: r.minMmr,
      maxMmr: r.maxMmr ?? undefined,
      rank: r.rank,
      sortOrder: r.sortOrder
    }));
  }

  async joinQueue(actor: AuthenticatedUser, body: QueueJoinRequest): Promise<QueueStatusResponse> {
    const mode = this.assertMode(body.mode);
    const format: MatchFormat = body.format === "3v3" ? "3v3" : "1v1";
    const current = this.statuses.get(actor.id);

    if (current?.state === "in_match") return this.toQueueStatus(actor.id, current);

    this.removeFromQueues(actor.id);

    const actorProfile = await this.prisma.playerProfile.findUnique({ where: { userId: actor.id } });
    const actorRegion = actorProfile?.region ?? undefined;

    if (format === "3v3") {
      return this.joinQueue3v3(actor, mode, actorRegion);
    }

    // ── 1v1 ──────────────────────────────────────────────────────────────────
    const queue = this.getQueue(mode, "1v1");
    const actorMmr = await this.getMmr(actor.id, mode);
    let opponent: QueueEntry | undefined;
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i]!;
      const opponentMmr = await this.getMmr(entry.playerId, mode);
      if (
        Math.abs(opponentMmr - actorMmr) <= this.cachedMaxMmrGap &&
        this.areRegionsCompatible(actorRegion, entry.region)
      ) {
        opponent = entry;
        queue.splice(i, 1);
        break;
      }
    }

    if (opponent) {
      const matchId = randomUUID();
      await this.prisma.match.create({
        data: {
          id: matchId,
          mode: mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN",
          format: "ONE_VS_ONE",
          participants: {
            createMany: { data: [{ userId: actor.id, team: 1 }, { userId: opponent.playerId, team: 2 }] }
          }
        }
      });

      const inMatch: PlayerStatus = { state: "in_match", mode, format: "1v1", matchId };
      this.statuses.set(actor.id, { ...inMatch, team: 1, opponentPlayerId: opponent.playerId });
      this.statuses.set(opponent.playerId, { ...inMatch, team: 2, opponentPlayerId: actor.id });

      const timer = setTimeout(
        () => this.expireMatch(matchId, [actor.id, opponent.playerId], mode),
        this.cachedMatchDurationSeconds * 1000
      );
      this.matchTimers.set(matchId, timer);

      return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
    }

    const queuedAt = new Date().toISOString();
    queue.push({ playerId: actor.id, mode, format: "1v1", queuedAt, region: actorRegion });
    this.statuses.set(actor.id, { state: "in_queue", mode, format: "1v1", queuedAt });

    return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
  }

  private async joinQueue3v3(actor: AuthenticatedUser, mode: GameMode, actorRegion?: string): Promise<QueueStatusResponse> {
    const queue = this.getQueue(mode, "3v3");
    const actorMmr = await this.getMmr(actor.id, mode);

    // Find up to 5 region-compatible candidates from queue
    const candidates = queue.filter((e) => this.areRegionsCompatible(actorRegion, e.region));

    if (candidates.length >= 5) {
      // Pick best 5 by MMR proximity (scan at most 20 to avoid DB overload)
      const sample = candidates.slice(0, 20);
      const withMmr = await Promise.all(
        sample.map(async (e) => ({ ...e, mmr: await this.getMmr(e.playerId, mode) }))
      );
      withMmr.sort((a, b) => Math.abs(a.mmr - actorMmr) - Math.abs(b.mmr - actorMmr));
      const selected = withMmr.slice(0, 5);

      // Remove selected from queue
      for (const s of selected) {
        const idx = queue.findIndex((e) => e.playerId === s.playerId);
        if (idx !== -1) queue.splice(idx, 1);
      }

      // Sort all 6 by MMR desc for snake draft
      const allSix = [{ playerId: actor.id, mmr: actorMmr }, ...selected.map((s) => ({ playerId: s.playerId, mmr: s.mmr }))];
      allSix.sort((a, b) => b.mmr - a.mmr);

      // Snake draft: positions 0,3,4 → team 1; positions 1,2,5 → team 2
      const SNAKE: (1 | 2)[] = [1, 2, 2, 1, 1, 2];
      const teamMap = new Map(allSix.map((p, i) => [p.playerId, SNAKE[i]!]));

      const matchId = randomUUID();
      await this.prisma.match.create({
        data: {
          id: matchId,
          mode: mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN",
          format: "THREE_VS_THREE",
          participants: {
            createMany: {
              data: allSix.map((p) => ({ userId: p.playerId, team: teamMap.get(p.playerId)! }))
            }
          }
        }
      });

      const allPlayerIds = allSix.map((p) => p.playerId);
      for (const { playerId } of allSix) {
        const team = teamMap.get(playerId)!;
        const teammateIds = allSix.filter((p) => p.playerId !== playerId && teamMap.get(p.playerId) === team).map((p) => p.playerId);
        this.statuses.set(playerId, { state: "in_match", mode, format: "3v3", matchId, team, teammateIds });
      }

      const timer = setTimeout(
        () => this.expireMatch(matchId, allPlayerIds, mode),
        this.cachedMatchDurationSeconds * 1000
      );
      this.matchTimers.set(matchId, timer);

      return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
    }

    const queuedAt = new Date().toISOString();
    queue.push({ playerId: actor.id, mode, format: "3v3", queuedAt, region: actorRegion });
    this.statuses.set(actor.id, { state: "in_queue", mode, format: "3v3", queuedAt });

    return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
  }

  leaveQueue(actor: AuthenticatedUser): QueueStatusResponse {
    const current = this.statuses.get(actor.id);
    if (current?.state === "in_match") return this.toQueueStatus(actor.id, current);

    this.removeFromQueues(actor.id);
    this.statuses.set(actor.id, { state: "online" });
    return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
  }

  getQueueStatus(actor: AuthenticatedUser): QueueStatusResponse {
    let status = this.statuses.get(actor.id);
    if (!status) {
      status = { state: "online" };
      this.statuses.set(actor.id, status);
    }
    return this.toQueueStatus(actor.id, status);
  }

  async submitResult(
    actor: AuthenticatedUser,
    matchId: string,
    body: MatchResultRequest
  ): Promise<MatchResultResponse> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { participants: true }
    });

    if (!match) throw new NotFoundException("Match not found.");
    if (match.finishedAt) throw new BadRequestException("Match result was already submitted.");

    const timer = this.matchTimers.get(matchId);
    if (timer) { clearTimeout(timer); this.matchTimers.delete(matchId); }

    const participantIds = match.participants.map((p) => p.userId);
    if (!participantIds.includes(actor.id)) {
      throw new BadRequestException("Only match participants can submit a result.");
    }

    const mode = match.mode.toLowerCase() as GameMode;

    if (match.format === "THREE_VS_THREE") {
      if (body.winnerTeam !== 1 && body.winnerTeam !== 2) {
        throw new BadRequestException("winnerTeam must be 1 or 2 for team matches.");
      }
      return this.finalizeMatch(matchId, participantIds, mode, actor.id, body.notes, undefined, body.winnerTeam as 1 | 2);
    }

    if (!body.winnerPlayerId || !participantIds.includes(body.winnerPlayerId)) {
      throw new BadRequestException("Winner must be one of the match participants.");
    }
    return this.finalizeMatch(matchId, participantIds, mode, actor.id, body.notes, body.winnerPlayerId);
  }

  async getPlayerMmr(playerId: string): Promise<PlayerMmrResponse> {
    const participations = await this.prisma.matchParticipant.findMany({
      where: { userId: playerId, outcome: { not: null } },
      include: { match: { select: { mode: true, finishedAt: true } } }
    });

    const ratings = await Promise.all(
      GAME_MODES.map(async (mode) => {
        const mmr = await this.getMmr(playerId, mode);
        const rank = this.resolveRank(mode, mmr);
        const modeKey = mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN";
        const modeMatches = participations.filter(
          (p) => p.match.mode === modeKey && p.match.finishedAt
        );
        const wins = modeMatches.filter((p) => p.outcome === "WIN").length;
        const losses = modeMatches.filter((p) => p.outcome === "LOSS").length;
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
        return { mode, mmr, rank, wins, losses, winRate };
      })
    );

    return { playerId, ratings };
  }

  async getPlayerMatches(playerId: string): Promise<MatchHistoryItem[]> {
    const entries = await this.prisma.matchParticipant.findMany({
      where: { userId: playerId },
      include: { match: { include: { participants: true } } },
      orderBy: { match: { startedAt: "desc" } }
    });

    return entries.map((entry) => {
      const is3v3 = entry.match.format === "THREE_VS_THREE";
      const format: MatchFormat = is3v3 ? "3v3" : "1v1";
      const playerTeam = entry.team as 1 | 2 | null;
      const teammates = is3v3
        ? entry.match.participants.filter((p) => p.userId !== playerId && p.team === entry.team).map((p) => p.userId)
        : undefined;
      const opponent = is3v3 ? undefined : entry.match.participants.find((p) => p.userId !== playerId);
      const outcome = entry.outcome?.toLowerCase() as "win" | "loss" | "draw" | undefined;
      const delta = entry.mmrAfter != null && entry.mmrBefore != null ? entry.mmrAfter - entry.mmrBefore : undefined;
      const durationSeconds = entry.match.finishedAt
        ? Math.round((entry.match.finishedAt.getTime() - entry.match.startedAt.getTime()) / 1000)
        : undefined;

      return {
        matchId: entry.matchId,
        mode: entry.match.mode.toLowerCase() as GameMode,
        format,
        team: playerTeam ?? undefined,
        teammates,
        createdAt: entry.match.startedAt.toISOString(),
        finishedAt: entry.match.finishedAt?.toISOString(),
        result: outcome,
        opponentPlayerId: opponent?.userId,
        mmrBefore: entry.mmrBefore ?? undefined,
        mmrAfter: entry.mmrAfter ?? undefined,
        mmrDelta: delta,
        rankBefore: delta !== undefined ? this.resolveRank(entry.match.mode.toLowerCase() as GameMode, entry.mmrBefore ?? 0) : undefined,
        rankAfter: delta !== undefined ? this.resolveRank(entry.match.mode.toLowerCase() as GameMode, entry.mmrAfter ?? 0) : undefined,
        xpAwarded: entry.xpAwarded ?? undefined,
        softCurrencyAwarded: undefined,
        durationSeconds,
        winnerPlayerId: entry.match.winnerUserId ?? undefined
      };
    });
  }

  getRankConfig(): RankConfig[] {
    return [...this.cachedRanks];
  }

  getQueueEntries(): { playerId: string; mode: GameMode; format: MatchFormat; queuedAt: string }[] {
    const result: { playerId: string; mode: GameMode; format: MatchFormat; queuedAt: string }[] = [];
    for (const entries of this.queues.values()) {
      for (const e of entries) {
        result.push({ playerId: e.playerId, mode: e.mode, format: e.format, queuedAt: e.queuedAt });
      }
    }
    return result;
  }

  getMaxMmrGap(): number { return this.cachedMaxMmrGap; }

  getActivePlayerStatuses(): { playerId: string; state: "online" | "in_queue" | "in_match"; mode?: GameMode; matchId?: string; queuedAt?: string }[] {
    return [...this.statuses.entries()]
      .filter(([, s]) => s.state !== "offline")
      .map(([playerId, s]) => ({
        playerId,
        state: s.state as "online" | "in_queue" | "in_match",
        mode: s.mode,
        matchId: s.matchId,
        queuedAt: s.queuedAt
      }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async finalizeMatch(
    matchId: string,
    participantIds: string[],
    mode: GameMode,
    actorId: string,
    resultNotes?: string,
    winnerPlayerId?: string,
    winnerTeam?: 1 | 2
  ): Promise<MatchResultResponse> {
    const finishedAt = new Date();
    const finishedAtStr = finishedAt.toISOString();

    // For 3v3 fetch team assignments from DB
    let teamMap: Map<string, number> | undefined;
    if (winnerTeam !== undefined) {
      const records = await this.prisma.matchParticipant.findMany({ where: { matchId } });
      teamMap = new Map(records.map((r) => [r.userId, r.team ?? 0]));
    }

    const participants = await Promise.all(
      participantIds.map(async (playerId) => {
        const outcome: MatchOutcome = teamMap
          ? (teamMap.get(playerId) === winnerTeam ? "win" : "loss")
          : (playerId === winnerPlayerId ? "win" : "loss");

        const mmrBefore = await this.getMmr(playerId, mode);
        const delta = MMR_DELTAS[mode][outcome];
        const mmrAfter = Math.max(0, mmrBefore + delta);
        const rankBefore = this.resolveRank(mode, mmrBefore);
        const rankAfter = this.resolveRank(mode, mmrAfter);

        await this.setMmr(playerId, mode, mmrAfter);

        const progression = await this.progressionService.awardMatchXp({
          playerId, mode, outcome, matchId, occurredAt: finishedAtStr, actorId
        });

        const softCurrencyAwarded = await this.economyService.awardSoftCurrency(playerId, mode, outcome, matchId);

        await this.prisma.matchParticipant.update({
          where: { matchId_userId: { matchId, userId: playerId } },
          data: { outcome: outcome.toUpperCase() as "WIN" | "LOSS" | "DRAW", mmrBefore, mmrAfter, xpAwarded: progression.xpAwarded }
        });

        this.statuses.set(playerId, { state: "online" });

        await this.prisma.auditLog.create({
          data: {
            actorId,
            action: "mmr.update",
            targetType: "player_mmr",
            targetId: playerId,
            metadata: { matchId, mode, mmrBefore, mmrAfter, mmrDelta: delta, rankBefore, rankAfter, softCurrencyAwarded } as never
          }
        });

        return { playerId, outcome, mmrBefore, mmrAfter, mmrDelta: delta, rankBefore, rankAfter, progression, softCurrencyAwarded };
      })
    );

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        finishedAt,
        winnerUserId: winnerPlayerId ?? null,
        winnerTeam: winnerTeam ?? null,
        resultSubmittedById: actorId,
        ...(resultNotes ? { resultNotes } : {})
      }
    });

    return { accepted: true, mmrUpdated: true, matchId, mode, participants };
  }

  private async expireMatch(matchId: string, playerIds: string[], mode: GameMode): Promise<void> {
    this.matchTimers.delete(matchId);
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || match.finishedAt) return;

    if (match.format === "THREE_VS_THREE") {
      const winnerTeam = (Math.random() < 0.5 ? 1 : 2) as 1 | 2;
      await this.finalizeMatch(matchId, playerIds, mode, playerIds[0]!, "timeout", undefined, winnerTeam);
    } else {
      const winnerPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)]!;
      await this.finalizeMatch(matchId, playerIds, mode, playerIds[0]!, "timeout", winnerPlayerId);
    }
  }

  private async getMmr(playerId: string, mode: GameMode): Promise<number> {
    const record = await this.prisma.playerMmr.upsert({
      where: { userId_mode: { userId: playerId, mode: mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN" } },
      create: { userId: playerId, mode: mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN", mmr: PLACEMENT_MMR },
      update: {}
    });
    return record.mmr;
  }

  private async setMmr(playerId: string, mode: GameMode, mmr: number): Promise<void> {
    const rank = this.resolveRank(mode, mmr);
    const [tier, div] = rank.split(" ");
    await this.prisma.playerMmr.upsert({
      where: { userId_mode: { userId: playerId, mode: mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN" } },
      create: { userId: playerId, mode: mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN", mmr, rankTier: tier ?? rank, rankDiv: div ?? "" },
      update: { mmr, rankTier: tier ?? rank, rankDiv: div ?? "" }
    });
  }

  private resolveRank(mode: GameMode, mmr: number): string {
    const matching = this.cachedRanks
      .filter((c) => c.mode === mode)
      .sort((a, b) => b.minMmr - a.minMmr)
      .find((c) => mmr >= c.minMmr && (c.maxMmr === undefined || mmr <= c.maxMmr));
    return matching?.rank ?? "UNRANKED";
  }

  private getQueue(mode: GameMode, format: MatchFormat): QueueEntry[] {
    const key = `${mode}-${format}`;
    const existing = this.queues.get(key);
    if (existing) return existing;
    const queue: QueueEntry[] = [];
    this.queues.set(key, queue);
    return queue;
  }

  private removeFromQueues(playerId: string): void {
    for (const [key, queue] of this.queues) {
      this.queues.set(key, queue.filter((e) => e.playerId !== playerId));
    }
  }

  private assertMode(mode: GameMode): GameMode {
    if (!GAME_MODES.includes(mode)) throw new BadRequestException("Unsupported game mode.");
    return mode;
  }

  private areRegionsCompatible(r1?: string, r2?: string): boolean {
    if (!r1 || !r2) return true;
    const c1 = REGION_CLUSTERS[r1];
    const c2 = REGION_CLUSTERS[r2];
    if (!c1 || !c2) return true;
    return c1 === c2;
  }

  private toQueueStatus(playerId: string, status: PlayerStatus): QueueStatusResponse {
    return {
      playerId,
      state: status.state,
      mode: status.mode,
      format: status.format,
      queuedAt: status.queuedAt,
      matchId: status.matchId,
      opponentPlayerId: status.opponentPlayerId,
      teammateIds: status.teammateIds,
      estimatedWaitSeconds: status.state === "in_queue" ? 30 : 0,
      matchDurationSeconds: this.cachedMatchDurationSeconds
    };
  }
}
