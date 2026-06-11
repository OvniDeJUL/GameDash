import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  GameMode,
  GrantedLevelReward,
  LevelReward,
  LevelThreshold,
  MatchProgressionResult,
  PlayerProgressionResponse,
  ProgressionRulesResponse
} from "@gamedash/contracts";

type MatchOutcome = "win" | "loss" | "draw";

interface ProgressionState {
  playerId: string;
  level: number;
  lifetimeXp: number;
  rewards: GrantedLevelReward[];
  updatedAt: string;
}

interface AwardMatchXpInput {
  playerId: string;
  mode: GameMode;
  outcome: MatchOutcome;
  matchId: string;
  occurredAt: string;
  actorId: string;
}

interface ProgressionAuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const BASE_XP_BY_MODE: Record<GameMode, number> = {
  ranked: 120,
  unranked: 90,
  fun: 60
};

const OUTCOME_XP: Record<MatchOutcome, number> = {
  win: 60,
  draw: 40,
  loss: 25
};

const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, minLifetimeXp: 0 },
  { level: 2, minLifetimeXp: 150 },
  { level: 3, minLifetimeXp: 350 },
  { level: 4, minLifetimeXp: 650 },
  { level: 5, minLifetimeXp: 1000 },
  { level: 6, minLifetimeXp: 1450 },
  { level: 7, minLifetimeXp: 2000 }
];

const LEVEL_REWARDS: LevelReward[] = [
  {
    level: 2,
    code: "profile_border_copper",
    label: "Copper profile border",
    rewardType: "cosmetic"
  },
  {
    level: 3,
    code: "title_queue_climber",
    label: "Queue Climber title",
    rewardType: "title"
  },
  {
    level: 4,
    code: "soft_currency_250",
    label: "250 soft currency",
    rewardType: "soft_currency",
    quantity: 250
  },
  {
    level: 5,
    code: "ranked_banner_silver",
    label: "Silver ranked banner",
    rewardType: "cosmetic"
  },
  {
    level: 6,
    code: "soft_currency_500",
    label: "500 soft currency",
    rewardType: "soft_currency",
    quantity: 500
  }
];

@Injectable()
export class ProgressionService {
  private readonly progressions = new Map<string, ProgressionState>();
  private readonly auditLogs: ProgressionAuditEntry[] = [];

  awardMatchXp(input: AwardMatchXpInput): MatchProgressionResult {
    const state = this.ensureProgression(input.playerId);
    const levelBefore = state.level;
    const lifetimeXpBefore = state.lifetimeXp;
    const xpAwarded = this.calculateMatchXp(input.mode, input.outcome);

    state.lifetimeXp += xpAwarded;
    state.level = this.resolveLevel(state.lifetimeXp);
    state.updatedAt = input.occurredAt;

    const rewardsGranted = this.grantNewLevelRewards(state, levelBefore + 1, state.level, input.occurredAt);

    this.auditLogs.push({
      id: randomUUID(),
      actorId: input.actorId,
      action: "progression.xp_award",
      targetType: "account_progression",
      targetId: input.playerId,
      metadata: {
        matchId: input.matchId,
        mode: input.mode,
        outcome: input.outcome,
        xpAwarded,
        levelBefore,
        levelAfter: state.level,
        lifetimeXpBefore,
        lifetimeXpAfter: state.lifetimeXp,
        rewardsGranted: rewardsGranted.map((reward) => reward.code)
      },
      createdAt: input.occurredAt
    });

    return {
      xpAwarded,
      levelBefore,
      levelAfter: state.level,
      lifetimeXpBefore,
      lifetimeXpAfter: state.lifetimeXp,
      rewardsGranted
    };
  }

  getPlayerProgression(playerId: string): PlayerProgressionResponse {
    return this.toProgressionResponse(this.ensureProgression(playerId));
  }

  getLevelRewards(): LevelReward[] {
    return [...LEVEL_REWARDS];
  }

  getProgressionRules(): ProgressionRulesResponse {
    return {
      baseXpByMode: { ...BASE_XP_BY_MODE },
      outcomeXp: { ...OUTCOME_XP },
      levelThresholds: [...LEVEL_THRESHOLDS]
    };
  }

  getAuditLogs(): ProgressionAuditEntry[] {
    return [...this.auditLogs];
  }

  private ensureProgression(playerId: string): ProgressionState {
    const existing = this.progressions.get(playerId);
    if (existing) {
      return existing;
    }

    const state: ProgressionState = {
      playerId,
      level: 1,
      lifetimeXp: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };
    this.progressions.set(playerId, state);
    return state;
  }

  private calculateMatchXp(mode: GameMode, outcome: MatchOutcome): number {
    return BASE_XP_BY_MODE[mode] + OUTCOME_XP[outcome];
  }

  private resolveLevel(lifetimeXp: number): number {
    return LEVEL_THRESHOLDS.filter((threshold) => lifetimeXp >= threshold.minLifetimeXp)
      .sort((a, b) => b.level - a.level)[0]?.level ?? 1;
  }

  private grantNewLevelRewards(
    state: ProgressionState,
    firstLevel: number,
    lastLevel: number,
    grantedAt: string
  ): GrantedLevelReward[] {
    if (lastLevel < firstLevel) {
      return [];
    }

    const alreadyGranted = new Set(state.rewards.map((reward) => reward.code));
    const rewardsGranted = LEVEL_REWARDS.filter(
      (reward) => reward.level >= firstLevel && reward.level <= lastLevel && !alreadyGranted.has(reward.code)
    ).map((reward) => ({
      ...reward,
      grantedAt
    }));

    state.rewards.push(...rewardsGranted);
    return rewardsGranted;
  }

  private toProgressionResponse(state: ProgressionState): PlayerProgressionResponse {
    const currentLevelMinXp = this.getLevelMinXp(state.level);
    const nextLevelXp = this.getNextLevelMinXp(state.level);
    const currentLevelXp = state.lifetimeXp - currentLevelMinXp;

    if (nextLevelXp === undefined) {
      return {
        playerId: state.playerId,
        level: state.level,
        lifetimeXp: state.lifetimeXp,
        currentLevelXp,
        levelProgressPercent: 100,
        rewards: [...state.rewards],
        updatedAt: state.updatedAt
      };
    }

    const levelSpan = nextLevelXp - currentLevelMinXp;
    const xpToNextLevel = nextLevelXp - state.lifetimeXp;

    return {
      playerId: state.playerId,
      level: state.level,
      lifetimeXp: state.lifetimeXp,
      currentLevelXp,
      nextLevelXp,
      xpToNextLevel,
      levelProgressPercent: Math.min(100, Math.round((currentLevelXp / levelSpan) * 100)),
      rewards: [...state.rewards],
      updatedAt: state.updatedAt
    };
  }

  private getLevelMinXp(level: number): number {
    return LEVEL_THRESHOLDS.find((threshold) => threshold.level === level)?.minLifetimeXp ?? 0;
  }

  private getNextLevelMinXp(level: number): number | undefined {
    return LEVEL_THRESHOLDS.find((threshold) => threshold.level === level + 1)?.minLifetimeXp;
  }
}
