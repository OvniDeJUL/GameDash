import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  GameMode,
  MatchHistoryItem,
  MatchResultRequest,
  MatchResultResponse,
  PlayerMmrResponse,
  QueueJoinRequest,
  QueueStatusResponse,
  RankConfig
} from "@gamedash/contracts";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ProgressionService } from "../progression/progression.service";
import { PrismaService } from "../prisma/prisma.service";

type PlayerState = QueueStatusResponse["state"];
type MatchOutcome = "win" | "loss" | "draw";

interface QueueEntry {
  playerId: string;
  mode: GameMode;
  queuedAt: string;
}

interface PlayerStatus {
  state: PlayerState;
  mode?: GameMode;
  matchId?: string;
  queuedAt?: string;
  opponentPlayerId?: string;
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
const MATCH_TIMEOUT_MS = 15_000;

@Injectable()
export class MatchmakingService implements OnModuleInit {
  /** In-memory queue — intentionally ephemeral (real-time matching). */
  private readonly queues = new Map<GameMode, QueueEntry[]>();
  private readonly statuses = new Map<string, PlayerStatus>();
  private readonly matchTimers = new Map<string, NodeJS.Timeout>();
  /** Live rank config cache — seeded from DB, refreshed on CRUD. */
  private cachedRanks: RankConfig[] = [...RANK_CONFIGS];

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgressionService) private readonly progressionService: ProgressionService
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
    const current = this.statuses.get(actor.id);

    if (current?.state === "in_match") return this.toQueueStatus(actor.id, current);

    this.removeFromQueues(actor.id);

    const queue = this.getQueue(mode);
    const opponent = queue.shift();

    if (opponent) {
      const matchId = randomUUID();
      await this.prisma.match.create({
        data: {
          id: matchId,
          mode: mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN",
          participants: {
            createMany: {
              data: [{ userId: actor.id }, { userId: opponent.playerId }]
            }
          }
        }
      });

      const inMatch: PlayerStatus = { state: "in_match", mode, matchId };
      this.statuses.set(actor.id, { ...inMatch, opponentPlayerId: opponent.playerId });
      this.statuses.set(opponent.playerId, { ...inMatch, opponentPlayerId: actor.id });

      const timer = setTimeout(
        () => this.expireMatch(matchId, [actor.id, opponent.playerId], mode),
        MATCH_TIMEOUT_MS
      );
      this.matchTimers.set(matchId, timer);

      return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
    }

    const queuedAt = new Date().toISOString();
    queue.push({ playerId: actor.id, mode, queuedAt });
    this.statuses.set(actor.id, { state: "in_queue", mode, queuedAt });

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
    if (!participantIds.includes(body.winnerPlayerId)) {
      throw new BadRequestException("Winner must be one of the match participants.");
    }

    const mode = match.mode.toLowerCase() as GameMode;
    return this.finalizeMatch(matchId, body.winnerPlayerId, participantIds, mode, actor.id, body.notes);
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
      const opponent = entry.match.participants.find((p) => p.userId !== playerId);
      const outcome = entry.outcome?.toLowerCase() as "win" | "loss" | "draw" | undefined;
      const delta = entry.mmrAfter != null && entry.mmrBefore != null
        ? entry.mmrAfter - entry.mmrBefore
        : undefined;
      const durationSeconds = entry.match.finishedAt
        ? Math.round((entry.match.finishedAt.getTime() - entry.match.startedAt.getTime()) / 1000)
        : undefined;

      return {
        matchId: entry.matchId,
        mode: entry.match.mode.toLowerCase() as GameMode,
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
        durationSeconds,
        winnerPlayerId: entry.match.winnerUserId ?? undefined
      };
    });
  }

  getRankConfig(): RankConfig[] {
    return [...this.cachedRanks];
  }

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
    winnerPlayerId: string,
    participantIds: string[],
    mode: GameMode,
    actorId: string,
    resultNotes?: string
  ): Promise<MatchResultResponse> {
    const finishedAt = new Date();
    const finishedAtStr = finishedAt.toISOString();

    const participants = await Promise.all(
      participantIds.map(async (playerId) => {
        const outcome: MatchOutcome = playerId === winnerPlayerId ? "win" : "loss";
        const mmrBefore = await this.getMmr(playerId, mode);
        const delta = MMR_DELTAS[mode][outcome];
        const mmrAfter = Math.max(0, mmrBefore + delta);
        const rankBefore = this.resolveRank(mode, mmrBefore);
        const rankAfter = this.resolveRank(mode, mmrAfter);

        await this.setMmr(playerId, mode, mmrAfter);

        const progression = await this.progressionService.awardMatchXp({
          playerId,
          mode,
          outcome,
          matchId,
          occurredAt: finishedAtStr,
          actorId
        });

        await this.prisma.matchParticipant.update({
          where: { matchId_userId: { matchId, userId: playerId } },
          data: {
            outcome: outcome.toUpperCase() as "WIN" | "LOSS" | "DRAW",
            mmrBefore,
            mmrAfter,
            xpAwarded: progression.xpAwarded
          }
        });

        this.statuses.set(playerId, { state: "online" });

        await this.prisma.auditLog.create({
          data: {
            actorId,
            action: "mmr.update",
            targetType: "player_mmr",
            targetId: playerId ?? "",
            metadata: { matchId, mode, mmrBefore, mmrAfter, mmrDelta: delta, rankBefore, rankAfter } as never
          }
        });

        return { playerId, outcome, mmrBefore, mmrAfter, mmrDelta: delta, rankBefore, rankAfter, progression };
      })
    );

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        finishedAt,
        winnerUserId: winnerPlayerId,
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

    const winnerPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)]!;
    await this.finalizeMatch(matchId, winnerPlayerId, playerIds, mode, playerIds[0]!, "timeout");
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

  private getQueue(mode: GameMode): QueueEntry[] {
    const existing = this.queues.get(mode);
    if (existing) return existing;
    const queue: QueueEntry[] = [];
    this.queues.set(mode, queue);
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

  private toQueueStatus(playerId: string, status: PlayerStatus): QueueStatusResponse {
    return {
      playerId,
      state: status.state,
      mode: status.mode,
      queuedAt: status.queuedAt,
      matchId: status.matchId,
      opponentPlayerId: status.opponentPlayerId,
      estimatedWaitSeconds: status.state === "in_queue" ? 30 : 0
    };
  }
}
