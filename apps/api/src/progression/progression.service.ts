import { Inject, Injectable } from "@nestjs/common";
import type {
  GameMode,
  GrantedLevelReward,
  LevelReward,
  LevelThreshold,
  MatchProgressionResult,
  PlayerProgressionResponse,
  ProgressionRulesResponse
} from "@gamedash/contracts";
import { PrismaService } from "../prisma/prisma.service";

type MatchOutcome = "win" | "loss" | "draw";

interface AwardMatchXpInput {
  playerId: string;
  mode: GameMode;
  outcome: MatchOutcome;
  matchId: string;
  occurredAt: string;
  actorId: string;
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
  { level: 2, code: "profile_border_copper", label: "Copper profile border", rewardType: "cosmetic" },
  { level: 3, code: "title_queue_climber", label: "Queue Climber title", rewardType: "title" },
  { level: 4, code: "soft_currency_250", label: "250 soft currency", rewardType: "soft_currency", quantity: 250 },
  { level: 5, code: "ranked_banner_silver", label: "Silver ranked banner", rewardType: "cosmetic" },
  { level: 6, code: "soft_currency_500", label: "500 soft currency", rewardType: "soft_currency", quantity: 500 }
];

@Injectable()
export class ProgressionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async awardMatchXp(input: AwardMatchXpInput): Promise<MatchProgressionResult> {
    const xpAwarded = BASE_XP_BY_MODE[input.mode] + OUTCOME_XP[input.outcome];

    const state = await this.prisma.accountProgression.upsert({
      where: { userId: input.playerId },
      create: { userId: input.playerId, level: 1, lifetimeXp: 0 },
      update: {}
    });

    const levelBefore = state.level;
    const lifetimeXpBefore = state.lifetimeXp;
    const lifetimeXpAfter = lifetimeXpBefore + xpAwarded;
    const levelAfter = this.resolveLevel(lifetimeXpAfter);

    await this.prisma.accountProgression.update({
      where: { userId: input.playerId },
      data: { lifetimeXp: lifetimeXpAfter, level: levelAfter }
    });

    const rewardsGranted = await this.grantNewLevelRewards(
      input.playerId,
      levelBefore + 1,
      levelAfter,
      input.occurredAt
    );

    await this.prisma.auditLog.create({
      data: {
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
          levelAfter,
          lifetimeXpBefore,
          lifetimeXpAfter,
          rewardsGranted: rewardsGranted.map((r) => r.code)
        } as never
      }
    });

    return {
      xpAwarded,
      levelBefore,
      levelAfter,
      lifetimeXpBefore,
      lifetimeXpAfter,
      rewardsGranted
    };
  }

  async getPlayerProgression(playerId: string): Promise<PlayerProgressionResponse> {
    const [state, grants] = await Promise.all([
      this.prisma.accountProgression.upsert({
        where: { userId: playerId },
        create: { userId: playerId, level: 1, lifetimeXp: 0 },
        update: {}
      }),
      this.prisma.playerLevelRewardGrant.findMany({ where: { userId: playerId } })
    ]);

    const rewards: GrantedLevelReward[] = grants.map((g) => ({
      level: g.level,
      code: g.rewardCode,
      label: g.label,
      rewardType: g.rewardType.toLowerCase() as GrantedLevelReward["rewardType"],
      quantity: g.quantity ?? undefined,
      grantedAt: g.grantedAt.toISOString()
    }));

    return this.toProgressionResponse(playerId, state.level, state.lifetimeXp, state.updatedAt.toISOString(), rewards);
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

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async grantNewLevelRewards(
    playerId: string,
    firstLevel: number,
    lastLevel: number,
    grantedAt: string
  ): Promise<GrantedLevelReward[]> {
    if (lastLevel < firstLevel) return [];

    const existing = await this.prisma.playerLevelRewardGrant.findMany({ where: { userId: playerId } });
    const alreadyGranted = new Set(existing.map((g) => g.rewardCode));

    const toGrant = LEVEL_REWARDS.filter(
      (r) => r.level >= firstLevel && r.level <= lastLevel && !alreadyGranted.has(r.code)
    );

    if (toGrant.length > 0) {
      await this.prisma.playerLevelRewardGrant.createMany({
        data: toGrant.map((r) => ({
          userId: playerId,
          level: r.level,
          rewardCode: r.code,
          label: r.label,
          rewardType: r.rewardType.toUpperCase() as "SOFT_CURRENCY" | "COSMETIC" | "TITLE",
          quantity: r.quantity,
          grantedAt: new Date(grantedAt)
        }))
      });
    }

    return toGrant.map((r) => ({ ...r, grantedAt }));
  }

  private resolveLevel(lifetimeXp: number): number {
    return LEVEL_THRESHOLDS.filter((t) => lifetimeXp >= t.minLifetimeXp)
      .sort((a, b) => b.level - a.level)[0]?.level ?? 1;
  }

  private toProgressionResponse(
    playerId: string,
    level: number,
    lifetimeXp: number,
    updatedAt: string,
    rewards: GrantedLevelReward[]
  ): PlayerProgressionResponse {
    const currentLevelMinXp = LEVEL_THRESHOLDS.find((t) => t.level === level)?.minLifetimeXp ?? 0;
    const nextLevelXp = LEVEL_THRESHOLDS.find((t) => t.level === level + 1)?.minLifetimeXp;
    const currentLevelXp = lifetimeXp - currentLevelMinXp;

    if (nextLevelXp === undefined) {
      return { playerId, level, lifetimeXp, currentLevelXp, levelProgressPercent: 100, rewards, updatedAt };
    }

    const levelSpan = nextLevelXp - currentLevelMinXp;
    const xpToNextLevel = nextLevelXp - lifetimeXp;

    return {
      playerId,
      level,
      lifetimeXp,
      currentLevelXp,
      nextLevelXp,
      xpToNextLevel,
      levelProgressPercent: Math.min(100, Math.round((currentLevelXp / levelSpan) * 100)),
      rewards,
      updatedAt
    };
  }
}
