import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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
  { mode: "ranked", minMmr: 0, maxMmr: 899, rank: "BRONZE III", sortOrder: 10 },
  { mode: "ranked", minMmr: 900, maxMmr: 1099, rank: "BRONZE II", sortOrder: 20 },
  { mode: "ranked", minMmr: 1100, maxMmr: 1299, rank: "SILVER I", sortOrder: 30 },
  { mode: "ranked", minMmr: 1300, maxMmr: 1599, rank: "GOLD I", sortOrder: 40 },
  { mode: "ranked", minMmr: 1600, rank: "PLATINUM", sortOrder: 50 },
  { mode: "unranked", minMmr: 0, rank: "UNRANKED", sortOrder: 10 },
  { mode: "fun", minMmr: 0, rank: "CASUAL", sortOrder: 10 }
];

const MMR_DELTAS: Record<GameMode, { win: number; loss: number }> = {
  ranked: { win: 32, loss: -24 },
  unranked: { win: 10, loss: -8 },
  fun: { win: 5, loss: -4 }
};

const PLACEMENT_MMR = 1000;

@Injectable()
export class MatchmakingService {
  /** In-memory queue — intentionally ephemeral (real-time matching). */
  private readonly queues = new Map<GameMode, QueueEntry[]>();
  private readonly statuses = new Map<string, PlayerStatus>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProgressionService) private readonly progressionService: ProgressionService
  ) {}

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
    const status = this.statuses.get(actor.id) ?? { state: "online" as const };
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

    const participantIds = match.participants.map((p) => p.userId);
    if (!participantIds.includes(actor.id)) {
      throw new BadRequestException("Only match participants can submit a result.");
    }
    if (!participantIds.includes(body.winnerPlayerId)) {
      throw new BadRequestException("Winner must be one of the match participants.");
    }

    const mode = match.mode.toLowerCase() as GameMode;
    const finishedAt = new Date().toISOString();

    const participants = await Promise.all(
      participantIds.map(async (playerId) => {
        const outcome: MatchOutcome = playerId === body.winnerPlayerId ? "win" : "loss";
        const mmrBefore = await this.getMmr(playerId, mode);
        const delta = MMR_DELTAS[mode][outcome];
        const mmrAfter = Math.max(0, mmrBefore + delta);
        const rankBefore = this.resolveRank(mode, mmrBefore);
        const rankAfter = this.resolveRank(mode, mmrAfter);

        await this.setMmr(playerId, mode, mmrAfter);
        await this.prisma.matchParticipant.update({
          where: { matchId_userId: { matchId, userId: playerId } },
          data: {
            outcome: outcome.toUpperCase() as "WIN" | "LOSS" | "DRAW",
            mmrBefore,
            mmrAfter
          }
        });

        this.statuses.set(playerId, { state: "online" });

        const progression = await this.progressionService.awardMatchXp({
          playerId,
          mode,
          outcome,
          matchId,
          occurredAt: finishedAt,
          actorId: actor.id
        });

        await this.prisma.auditLog.create({
          data: {
            actorId: actor.id,
            action: "mmr.update",
            targetType: "player_mmr",
            targetId: playerId,
            metadata: { matchId, mode, mmrBefore, mmrAfter, mmrDelta: delta, rankBefore, rankAfter } as never
          }
        });

        return { playerId, outcome, mmrBefore, mmrAfter, mmrDelta: delta, rankBefore, rankAfter, progression };
      })
    );

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        finishedAt: new Date(finishedAt),
        winnerUserId: body.winnerPlayerId,
        resultNotes: body.notes,
        resultSubmittedById: actor.id
      }
    });

    return { accepted: true, mmrUpdated: true, matchId, mode, participants };
  }

  async getPlayerMmr(playerId: string): Promise<PlayerMmrResponse> {
    const ratings = await Promise.all(
      GAME_MODES.map(async (mode) => {
        const mmr = await this.getMmr(playerId, mode);
        return { mode, mmr, rank: this.resolveRank(mode, mmr) };
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
        rankAfter: delta !== undefined ? this.resolveRank(entry.match.mode.toLowerCase() as GameMode, entry.mmrAfter ?? 0) : undefined
      };
    });
  }

  getRankConfig(): RankConfig[] {
    return [...RANK_CONFIGS];
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

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
    const matching = RANK_CONFIGS.filter((c) => c.mode === mode)
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
    for (const [mode, queue] of this.queues) {
      this.queues.set(mode, queue.filter((e) => e.playerId !== playerId));
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
