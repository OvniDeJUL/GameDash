import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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

interface StoredMatch {
  id: string;
  mode: GameMode;
  participantIds: [string, string];
  createdAt: string;
  finishedAt?: string;
  winnerPlayerId?: string;
  notes?: string;
}

interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
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

@Injectable()
export class MatchmakingService {
  constructor(private readonly progressionService = new ProgressionService()) {}

  private readonly queues = new Map<GameMode, QueueEntry[]>();
  private readonly statuses = new Map<string, PlayerStatus>();
  private readonly matches = new Map<string, StoredMatch>();
  private readonly ratings = new Map<string, Map<GameMode, number>>();
  private readonly histories = new Map<string, MatchHistoryItem[]>();
  private readonly auditLogs: AuditEntry[] = [];

  joinQueue(actor: AuthenticatedUser, body: QueueJoinRequest): QueueStatusResponse {
    const mode = this.assertMode(body.mode);
    const current = this.statuses.get(actor.id);

    if (current?.state === "in_match") {
      return this.toQueueStatus(actor.id, current);
    }

    this.removeFromQueues(actor.id);
    this.ensureRatings(actor.id);

    const queue = this.getQueue(mode);
    const opponent = queue.shift();

    if (opponent) {
      const match = this.createMatch(mode, actor.id, opponent.playerId);
      this.statuses.set(actor.id, {
        state: "in_match",
        mode,
        matchId: match.id,
        opponentPlayerId: opponent.playerId
      });
      this.statuses.set(opponent.playerId, {
        state: "in_match",
        mode,
        matchId: match.id,
        opponentPlayerId: actor.id
      });

      return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
    }

    const queuedAt = new Date().toISOString();
    const entry: QueueEntry = { playerId: actor.id, mode, queuedAt };
    queue.push(entry);
    this.statuses.set(actor.id, { state: "in_queue", mode, queuedAt });

    return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
  }

  leaveQueue(actor: AuthenticatedUser): QueueStatusResponse {
    const current = this.statuses.get(actor.id);

    if (current?.state === "in_match") {
      return this.toQueueStatus(actor.id, current);
    }

    this.removeFromQueues(actor.id);
    this.statuses.set(actor.id, { state: "online" });
    return this.toQueueStatus(actor.id, this.statuses.get(actor.id)!);
  }

  getQueueStatus(actor: AuthenticatedUser): QueueStatusResponse {
    const status = this.statuses.get(actor.id) ?? { state: "online" as const };
    return this.toQueueStatus(actor.id, status);
  }

  submitResult(
    actor: AuthenticatedUser,
    matchId: string,
    body: MatchResultRequest
  ): MatchResultResponse {
    const match = this.matches.get(matchId);

    if (!match) {
      throw new NotFoundException("Match not found.");
    }

    if (match.finishedAt) {
      throw new BadRequestException("Match result was already submitted.");
    }

    if (!match.participantIds.includes(actor.id)) {
      throw new BadRequestException("Only match participants can submit a result.");
    }

    if (!match.participantIds.includes(body.winnerPlayerId)) {
      throw new BadRequestException("Winner must be one of the match participants.");
    }

    const finishedAt = new Date().toISOString();
    const participants = match.participantIds.map((playerId) => {
      const outcome: MatchOutcome = playerId === body.winnerPlayerId ? "win" : "loss";
      const mmrBefore = this.getMmrValue(playerId, match.mode);
      const mmrDelta = this.calculateMmrDelta(match.mode, outcome);
      const mmrAfter = Math.max(0, mmrBefore + mmrDelta);
      const rankBefore = this.resolveRank(match.mode, mmrBefore);
      const rankAfter = this.resolveRank(match.mode, mmrAfter);
      const progression = this.progressionService.awardMatchXp({
        playerId,
        mode: match.mode,
        outcome,
        matchId: match.id,
        occurredAt: finishedAt,
        actorId: actor.id
      });

      this.setMmrValue(playerId, match.mode, mmrAfter);
      this.statuses.set(playerId, { state: "online" });
      this.addHistory(playerId, {
        matchId: match.id,
        mode: match.mode,
        createdAt: match.createdAt,
        finishedAt,
        result: outcome,
        opponentPlayerId: this.getOpponentId(match, playerId),
        mmrBefore,
        mmrAfter,
        mmrDelta,
        rankBefore,
        rankAfter
      });
      this.audit(actor.id, "mmr.update", "player_mmr", playerId, {
        matchId: match.id,
        mode: match.mode,
        mmrBefore,
        mmrAfter,
        mmrDelta,
        rankBefore,
        rankAfter
      });

      return {
        playerId,
        outcome,
        mmrBefore,
        mmrAfter,
        mmrDelta,
        rankBefore,
        rankAfter,
        progression
      };
    });

    match.finishedAt = finishedAt;
    match.winnerPlayerId = body.winnerPlayerId;
    match.notes = body.notes;

    return {
      accepted: true,
      mmrUpdated: true,
      matchId: match.id,
      mode: match.mode,
      participants
    };
  }

  getPlayerMmr(playerId: string): PlayerMmrResponse {
    this.ensureRatings(playerId);
    const ratings = GAME_MODES.map((mode) => {
      const mmr = this.getMmrValue(playerId, mode);
      return {
        mode,
        mmr,
        rank: this.resolveRank(mode, mmr)
      };
    });

    return { playerId, ratings };
  }

  getPlayerMatches(playerId: string): MatchHistoryItem[] {
    return [...(this.histories.get(playerId) ?? [])];
  }

  getRankConfig(): RankConfig[] {
    return [...RANK_CONFIGS];
  }

  getAuditLogs(): AuditEntry[] {
    return [...this.auditLogs];
  }

  private createMatch(mode: GameMode, playerA: string, playerB: string): StoredMatch {
    const match: StoredMatch = {
      id: randomUUID(),
      mode,
      participantIds: [playerA, playerB],
      createdAt: new Date().toISOString()
    };
    this.matches.set(match.id, match);
    return match;
  }

  private getQueue(mode: GameMode): QueueEntry[] {
    const existing = this.queues.get(mode);
    if (existing) {
      return existing;
    }

    const queue: QueueEntry[] = [];
    this.queues.set(mode, queue);
    return queue;
  }

  private removeFromQueues(playerId: string): void {
    for (const [mode, queue] of this.queues) {
      this.queues.set(
        mode,
        queue.filter((entry) => entry.playerId !== playerId)
      );
    }
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

  private ensureRatings(playerId: string): Map<GameMode, number> {
    const existing = this.ratings.get(playerId);
    if (existing) {
      return existing;
    }

    const ratings = new Map<GameMode, number>();
    for (const mode of GAME_MODES) {
      ratings.set(mode, 1000);
    }
    this.ratings.set(playerId, ratings);
    return ratings;
  }

  private getMmrValue(playerId: string, mode: GameMode): number {
    return this.ensureRatings(playerId).get(mode) ?? 1000;
  }

  private setMmrValue(playerId: string, mode: GameMode, value: number): void {
    this.ensureRatings(playerId).set(mode, value);
  }

  private resolveRank(mode: GameMode, mmr: number): string {
    const matching = RANK_CONFIGS.filter((config) => config.mode === mode)
      .sort((a, b) => b.minMmr - a.minMmr)
      .find((config) => mmr >= config.minMmr && (config.maxMmr === undefined || mmr <= config.maxMmr));

    return matching?.rank ?? "UNRANKED";
  }

  private calculateMmrDelta(mode: GameMode, outcome: MatchOutcome): number {
    if (outcome === "draw") {
      return 0;
    }

    const win = outcome === "win";
    if (mode === "ranked") {
      return win ? 32 : -24;
    }
    if (mode === "unranked") {
      return win ? 10 : -8;
    }

    return win ? 5 : -4;
  }

  private getOpponentId(match: StoredMatch, playerId: string): string {
    const opponent = match.participantIds.find((participantId) => participantId !== playerId);
    if (!opponent) {
      throw new BadRequestException("Match opponent not found.");
    }

    return opponent;
  }

  private addHistory(playerId: string, item: MatchHistoryItem): void {
    const history = this.histories.get(playerId) ?? [];
    history.unshift(item);
    this.histories.set(playerId, history);
  }

  private assertMode(mode: GameMode): GameMode {
    if (!GAME_MODES.includes(mode)) {
      throw new BadRequestException("Unsupported game mode.");
    }

    return mode;
  }

  private audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.auditLogs.push({
      id: randomUUID(),
      actorId,
      action,
      targetType,
      targetId,
      metadata,
      createdAt: new Date().toISOString()
    });
  }
}
