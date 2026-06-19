import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AccountModerationRequest,
  AdminActivePlayerStatus,
  AdminCreateRankConfigRequest,
  AdminCreateStoreItemRequest,
  AdminDashboardSummary,
  AdminLiveMatch,
  AdminLiveMatchParticipant,
  AdminMatchDetail,
  AdminMatchParticipantDetail,
  AdminPlayerResponse,
  AdminQueueEntry,
  AdminQueueSnapshot,
  AdminRankConfigItem,
  AdminSanctionEntry,
  AdminTransactionJournalEntry,
  AdminUpdateRankConfigRequest,
  AdminUpdateStoreItemRequest,
  AdminUpdatePlayerRequest,
  AuditLogEntry,
  CurrencyType,
  GameMode,
  AdminPlayerTimeline,
  AdminPlayerTimelineEvent,
  MapModerationRequest,
  MapReportItem,
  MapStatus,
  ModerationActionResponse,
  ModerationSignalResponse,
  StaffActiveCreator,
  StaffEconomyAnalyticsResponse,
  StaffEconomyItemStat,
  StaffMapAdminItem,
  StaffMapsAnalyticsResponse,
  StaffRankAnalyticsResponse,
  StaffRankDistributionItem,
  StoreItem,
  StudioSettingsResponse,
  UpdateStudioSettingsRequest
} from "@gamedash/contracts";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EconomyService } from "../economy/economy.service";
import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { ProgressionService } from "../progression/progression.service";

const DEFAULT_SETTINGS: StudioSettingsResponse = {
  matchmaking: { rankedQueueMaxWaitSeconds: 90, funQueueMaxWaitSeconds: 45, matchSize: 2, maxMmrGap: 400, matchDurationSeconds: 15 },
  mmr: { placementMmr: 1000, rankedWinDelta: 32, rankedLossDelta: -24, unrankedWinDelta: 10, unrankedLossDelta: -8 },
  economy: { starterSoftBalance: 1000, starterHardBalance: 20, purchaseEnabled: true, refundWindowHours: 24 },
  rewards: {
    rankedBaseXp: 120, unrankedBaseXp: 90, funBaseXp: 60,
    winBonusXp: 60, drawBonusXp: 40, lossXp: 25,
    rankedSoftBase: 50, rankedSoftWinBonus: 25,
    unrankedSoftBase: 40, unrankedSoftWinBonus: 20,
    funSoftBase: 25, funSoftWinBonus: 10
  },
  updatedAt: new Date(0).toISOString()
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MatchmakingService) private readonly matchmakingService: MatchmakingService,
    @Inject(ProgressionService) private readonly progressionService: ProgressionService,
    @Inject(EconomyService) private readonly economyService: EconomyService
  ) {}

  async getDashboard(): Promise<AdminDashboardSummary> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activePlayers, dailyMatches, virtualRevenue, mapActivity, openSignals, activeSanctions, lastSettings] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.match.count({ where: { startedAt: { gte: dayAgo } } }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { status: "ACCEPTED", createdAt: { gte: dayAgo } }
        }),
        this.prisma.mapTest.count({ where: { createdAt: { gte: dayAgo } } }),
        this.prisma.moderationSignal.count({ where: { status: "open" } }),
        this.prisma.sanction.count({ where: { status: "active" } }),
        this.prisma.studioSetting.findUnique({ where: { key: "__meta" } })
      ]);

    return {
      activePlayers,
      dailyMatches,
      virtualRevenue: virtualRevenue._sum.amount ?? 0,
      mapActivity,
      openModerationSignals: openSignals,
      activeSanctions,
      settingsLastUpdated: lastSettings
        ? (lastSettings.value as { updatedAt: string }).updatedAt
        : DEFAULT_SETTINGS.updatedAt
    };
  }

  async getSettings(): Promise<StudioSettingsResponse> {
    return this.loadSettings();
  }

  async updateSettings(actor: AuthenticatedUser, body: UpdateStudioSettingsRequest): Promise<StudioSettingsResponse> {
    const current = await this.loadSettings();
    const next: StudioSettingsResponse = {
      matchmaking: { ...current.matchmaking, ...body.matchmaking },
      mmr: { ...current.mmr, ...body.mmr },
      economy: { ...current.economy, ...body.economy },
      rewards: { ...current.rewards, ...body.rewards },
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id
    };
    this.assertSettings(next);

    await Promise.all([
      this.prisma.studioSetting.upsert({
        where: { key: "matchmaking" },
        create: { key: "matchmaking", value: next.matchmaking as never, updatedById: actor.id },
        update: { value: next.matchmaking as never, updatedById: actor.id }
      }),
      this.prisma.studioSetting.upsert({
        where: { key: "mmr" },
        create: { key: "mmr", value: next.mmr as never, updatedById: actor.id },
        update: { value: next.mmr as never, updatedById: actor.id }
      }),
      this.prisma.studioSetting.upsert({
        where: { key: "economy" },
        create: { key: "economy", value: next.economy as never, updatedById: actor.id },
        update: { value: next.economy as never, updatedById: actor.id }
      }),
      this.prisma.studioSetting.upsert({
        where: { key: "rewards" },
        create: { key: "rewards", value: next.rewards as never, updatedById: actor.id },
        update: { value: next.rewards as never, updatedById: actor.id }
      }),
      this.prisma.studioSetting.upsert({
        where: { key: "__meta" },
        create: { key: "__meta", value: { updatedAt: next.updatedAt, updatedBy: actor.id }, updatedById: actor.id },
        update: { value: { updatedAt: next.updatedAt, updatedBy: actor.id }, updatedById: actor.id }
      })
    ]);

    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: "admin.settings.update", targetType: "studio_settings", targetId: "global", metadata: { sections: Object.keys(body) } as never }
    });

    await Promise.all([
      this.matchmakingService.reloadMatchmakingSettings(),
      this.progressionService.reloadRewardSettings(),
      this.economyService.reloadRewardSettings()
    ]);

    return next;
  }

  async moderateAccount(
    actor: AuthenticatedUser,
    targetUserId: string,
    body: AccountModerationRequest
  ): Promise<ModerationActionResponse> {
    const reason = this.assertReason(body.reason);
    const action = `account.${body.action}`;
    const expiresAt = body.durationHours && body.durationHours > 0
      ? new Date(Date.now() + body.durationHours * 3_600_000)
      : undefined;

    const record = await this.prisma.moderationHistory.create({
      data: {
        actorId: actor.id,
        targetType: "account",
        targetId: targetUserId,
        action,
        reason,
        expiresAt,
        metadata: { durationHours: body.durationHours }
      }
    });

    if (body.action === "suspend" || body.action === "ban") {
      await this.prisma.sanction.create({
        data: {
          userId: targetUserId,
          actorId: actor.id,
          type: body.action === "ban" ? "BAN" : "SUSPENSION",
          reason,
          status: "active",
          endsAt: expiresAt
        }
      });
    } else if (body.action === "unban") {
      await this.prisma.sanction.updateMany({
        where: { userId: targetUserId, type: "BAN", status: "active" },
        data: { status: "revoked" }
      });
    } else if (body.action === "unsuspend") {
      await this.prisma.sanction.updateMany({
        where: { userId: targetUserId, type: "SUSPENSION", status: "active" },
        data: { status: "revoked" }
      });
    }

    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: "admin.moderation.account", targetType: "account", targetId: targetUserId, metadata: { action, reason } as never }
    });

    return { id: record.id, targetType: "account", targetId: targetUserId, action, reason, actorId: actor.id, createdAt: record.createdAt.toISOString(), expiresAt: expiresAt?.toISOString() };
  }

  async moderateMap(
    actor: AuthenticatedUser,
    mapId: string,
    body: MapModerationRequest
  ): Promise<ModerationActionResponse> {
    const reason = this.assertReason(body.reason);
    const action = `map.${body.action}`;

    if (body.action === "hide") {
      await this.prisma.gameMap.update({ where: { id: mapId }, data: { status: "HIDDEN", lastModerationAt: new Date() } });
    } else if (body.action === "restore") {
      await this.prisma.gameMap.update({ where: { id: mapId }, data: { status: "STABLE", lastModerationAt: new Date() } });
    } else if (body.action === "feature") {
      await this.prisma.gameMap.update({ where: { id: mapId }, data: { status: "STABLE", reviewStatus: "featured", lastModerationAt: new Date() } });
    } else if (body.action === "validate") {
      await this.prisma.gameMap.update({ where: { id: mapId }, data: { status: "STABLE", reviewStatus: "approved", lastModerationAt: new Date() } });
    }

    const record = await this.prisma.moderationHistory.create({
      data: { actorId: actor.id, targetType: "map", targetId: mapId, action, reason }
    });

    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: "admin.moderation.map", targetType: "map", targetId: mapId, metadata: { action, reason } as never }
    });

    return { id: record.id, targetType: "map", targetId: mapId, action, reason, actorId: actor.id, createdAt: record.createdAt.toISOString() };
  }

  async getModerationHistory(): Promise<ModerationActionResponse[]> {
    const records = await this.prisma.moderationHistory.findMany({ orderBy: { createdAt: "desc" } });
    return records.map((r) => ({
      id: r.id,
      targetType: r.targetType as "account" | "map",
      targetId: r.targetId,
      action: r.action,
      reason: r.reason,
      actorId: r.actorId,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString()
    }));
  }

  async getMapReports(): Promise<MapReportItem[]> {
    const reports = await this.prisma.mapReport.findMany({
      where: { status: "open" },
      include: {
        map: { select: { title: true } },
        reporter: { include: { profile: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return reports.map((r) => ({
      id: r.id,
      mapId: r.mapId,
      mapTitle: r.map.title,
      reporterId: r.reporterId,
      reporterPseudo: r.reporter.profile?.pseudo ?? r.reporter.id,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString()
    }));
  }

  async dismissMapReport(reportId: string, action: "reviewed" | "dismissed"): Promise<void> {
    const report = await this.prisma.mapReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException("Report not found.");
    await this.prisma.mapReport.update({ where: { id: reportId }, data: { status: action } });
  }

  async getPlayerTimeline(userId: string): Promise<AdminPlayerTimeline> {
    const [modRecords, matchRecords] = await Promise.all([
      this.prisma.moderationHistory.findMany({
        where: { targetType: "account", targetId: userId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.matchParticipant.findMany({
        where: { userId },
        include: { match: true },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const modEvents: AdminPlayerTimelineEvent[] = modRecords.map((r) => ({
      id: r.id,
      date: r.createdAt.toISOString(),
      kind: "moderation" as const,
      action: r.action,
      reason: r.reason,
      actorId: r.actorId
    }));

    const matchEvents: AdminPlayerTimelineEvent[] = matchRecords.map((p) => {
      const mmrDelta = p.mmrBefore != null && p.mmrAfter != null ? p.mmrAfter - p.mmrBefore : undefined;
      return {
        id: p.id,
        date: (p.match.finishedAt ?? p.createdAt).toISOString(),
        kind: "match" as const,
        matchId: p.matchId,
        mode: p.match.mode.toLowerCase() as GameMode,
        result: p.outcome?.toLowerCase(),
        mmrBefore: p.mmrBefore ?? undefined,
        mmrAfter: p.mmrAfter ?? undefined,
        mmrDelta
      };
    });

    const events = [...modEvents, ...matchEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return { userId, events };
  }

  async listPlayers(): Promise<AdminPlayerResponse[]> {
    const users = await this.prisma.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: "desc" }
    });
    return users.map((u) => this.toPlayerResponse(u));
  }

  async updatePlayer(userId: string, body: AdminUpdatePlayerRequest): Promise<AdminPlayerResponse> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException("Player not found.");

    if (body.role || body.email) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(body.email ? { email: body.email } : {}),
          ...(body.role ? { role: body.role.toUpperCase() as "PLAYER" | "STAFF" | "ADMIN" } : {})
        }
      });
    }

    const hasProfileUpdate = body.pseudo !== undefined || body.region !== undefined || body.bio !== undefined;
    if (hasProfileUpdate) {
      await this.prisma.playerProfile.upsert({
        where: { userId },
        create: { userId, pseudo: body.pseudo ?? "" },
        update: {
          ...(body.pseudo !== undefined ? { pseudo: body.pseudo } : {}),
          ...(body.region !== undefined ? { region: body.region } : {}),
          ...(body.bio !== undefined ? { bio: body.bio } : {})
        }
      });
    }

    const updated = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    return this.toPlayerResponse(updated!);
  }

  async getModerationSignals(): Promise<ModerationSignalResponse[]> {
    const signals = await this.prisma.moderationSignal.findMany({ orderBy: { createdAt: "desc" } });
    return signals.map((s) => ({
      id: s.id,
      targetType: s.targetType as "account" | "map",
      targetId: s.targetId,
      reason: s.reason,
      status: s.status as "open" | "reviewed" | "dismissed",
      source: s.source,
      createdAt: s.createdAt.toISOString()
    }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toPlayerResponse(user: { id: string; email: string; role: string; createdAt: Date; profile: { pseudo: string; region: string | null; bio: string | null } | null }): AdminPlayerResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase() as "player" | "staff" | "admin",
      pseudo: user.profile?.pseudo ?? undefined,
      region: user.profile?.region ?? undefined,
      bio: user.profile?.bio ?? undefined,
      createdAt: user.createdAt.toISOString()
    };
  }

  private async loadSettings(): Promise<StudioSettingsResponse> {
    const rows = await this.prisma.studioSetting.findMany({ where: { key: { in: ["matchmaking", "mmr", "economy", "rewards", "__meta"] } } });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const meta = byKey["__meta"] as { updatedAt?: string; updatedBy?: string } | undefined;

    return {
      matchmaking: { ...DEFAULT_SETTINGS.matchmaking, ...(byKey["matchmaking"] as unknown as Partial<StudioSettingsResponse["matchmaking"]> ?? {}) },
      mmr: { ...DEFAULT_SETTINGS.mmr, ...(byKey["mmr"] as unknown as Partial<StudioSettingsResponse["mmr"]> ?? {}) },
      economy: { ...DEFAULT_SETTINGS.economy, ...(byKey["economy"] as unknown as Partial<StudioSettingsResponse["economy"]> ?? {}) },
      rewards: { ...DEFAULT_SETTINGS.rewards, ...(byKey["rewards"] as unknown as Partial<StudioSettingsResponse["rewards"]> ?? {}) },
      updatedAt: meta?.updatedAt ?? DEFAULT_SETTINGS.updatedAt,
      updatedBy: meta?.updatedBy
    };
  }

  async getQueueSnapshot(): Promise<AdminQueueSnapshot> {
    const settings = await this.loadSettings();
    const queueEntries = this.matchmakingService.getQueueEntries();
    const activeStatuses = this.matchmakingService.getActivePlayerStatuses();

    const inMatchStatuses = activeStatuses.filter((s) => s.state === "in_match" && s.matchId);
    const matchIds = [...new Set(inMatchStatuses.map((s) => s.matchId!))];
    const playerIds = [...new Set([
      ...queueEntries.map((e) => e.playerId),
      ...inMatchStatuses.map((s) => s.playerId)
    ])];

    const [profiles, mmrRecords, matches] = await Promise.all([
      this.prisma.playerProfile.findMany({ where: { userId: { in: playerIds } }, select: { userId: true, pseudo: true } }),
      this.prisma.playerMmr.findMany({ where: { userId: { in: playerIds } } }),
      matchIds.length > 0
        ? this.prisma.match.findMany({ where: { id: { in: matchIds } }, include: { participants: true } })
        : Promise.resolve([])
    ]);

    const pseudoMap = new Map(profiles.map((p) => [p.userId, p.pseudo]));
    const mmrMap = new Map<string, number>();
    const rankMap = new Map<string, string>();
    for (const r of mmrRecords) {
      mmrMap.set(`${r.userId}:${r.mode.toLowerCase()}`, r.mmr);
      rankMap.set(`${r.userId}:${r.mode.toLowerCase()}`, r.rankDiv ? `${r.rankTier} ${r.rankDiv}`.trim() : r.rankTier);
    }

    const inQueue: AdminQueueEntry[] = queueEntries.map((e) => ({
      playerId: e.playerId,
      pseudo: pseudoMap.get(e.playerId),
      mode: e.mode,
      mmr: mmrMap.get(`${e.playerId}:${e.mode}`) ?? 1000,
      rank: rankMap.get(`${e.playerId}:${e.mode}`) ?? "Unranked",
      queuedAt: e.queuedAt
    }));

    const liveMatches: AdminLiveMatch[] = matches.map((m) => ({
      matchId: m.id,
      mode: m.mode.toLowerCase() as GameMode,
      startedAt: m.startedAt.toISOString(),
      teamSize: settings.matchmaking.matchSize,
      participants: m.participants.map((p): AdminLiveMatchParticipant => {
        const mode = m.mode.toLowerCase();
        return {
          playerId: p.userId,
          pseudo: pseudoMap.get(p.userId),
          mmr: mmrMap.get(`${p.userId}:${mode}`) ?? 1000,
          rank: rankMap.get(`${p.userId}:${mode}`) ?? "Unranked"
        };
      })
    }));

    return {
      inQueue,
      liveMatches,
      maxMmrGap: settings.matchmaking.maxMmrGap,
      teamSize: settings.matchmaking.matchSize
    };
  }

  private assertReason(reason: string): string {
    const normalized = reason.trim();
    if (!normalized) throw new BadRequestException("Moderation reason is required.");
    return normalized;
  }

  private assertSettings(settings: StudioSettingsResponse): void {
    if (settings.matchmaking.matchSize < 2) throw new BadRequestException("Match size must be at least 2.");
    if (settings.economy.starterSoftBalance < 0 || settings.economy.starterHardBalance < 0) {
      throw new BadRequestException("Starter balances cannot be negative.");
    }
    if (settings.economy.refundWindowHours < 0) throw new BadRequestException("Refund window cannot be negative.");
  }

  // ─── Overview drill-downs ─────────────────────────────────────────────────

  async getActivePlayerStatuses(): Promise<AdminActivePlayerStatus[]> {
    const rawStatuses = this.matchmakingService.getActivePlayerStatuses();
    if (rawStatuses.length === 0) return [];

    const playerIds = rawStatuses.map((s) => s.playerId);
    const profiles = await this.prisma.playerProfile.findMany({
      where: { userId: { in: playerIds } },
      select: { userId: true, pseudo: true }
    });
    const pseudoMap = new Map(profiles.map((p) => [p.userId, p.pseudo]));

    return rawStatuses.map((s) => ({
      ...s,
      pseudo: pseudoMap.get(s.playerId)
    }));
  }

  async getDailyMatches(): Promise<AdminMatchDetail[]> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const matches = await this.prisma.match.findMany({
      where: { startedAt: { gte: dayAgo } },
      include: {
        participants: {
          include: { user: { select: { profile: { select: { pseudo: true } } } } }
        }
      },
      orderBy: { startedAt: "desc" }
    });

    return matches.map((m) => {
      const durationSeconds = m.finishedAt
        ? Math.round((m.finishedAt.getTime() - m.startedAt.getTime()) / 1000)
        : undefined;
      const participants: AdminMatchParticipantDetail[] = m.participants.map((p) => ({
        playerId: p.userId,
        pseudo: p.user.profile?.pseudo,
        team: p.team ?? undefined,
        outcome: (p.outcome?.toLowerCase() ?? "draw") as "win" | "loss" | "draw",
        mmrBefore: p.mmrBefore ?? 0,
        mmrAfter: p.mmrAfter ?? 0,
        mmrDelta: p.mmrAfter != null && p.mmrBefore != null ? p.mmrAfter - p.mmrBefore : 0
      }));
      return {
        matchId: m.id,
        mode: m.mode.toLowerCase() as GameMode,
        format: m.format === "THREE_VS_THREE" ? "3v3" : "1v1",
        startedAt: m.startedAt.toISOString(),
        finishedAt: m.finishedAt?.toISOString(),
        durationSeconds,
        participants
      };
    });
  }

  // ─── Staff analytics ──────────────────────────────────────────────────────

  async getRankAnalytics(): Promise<StaffRankAnalyticsResponse> {
    const [mmrRecords, participants] = await Promise.all([
      this.prisma.playerMmr.findMany({ where: { mode: "RANKED" } }),
      this.prisma.matchParticipant.findMany({
        where: { outcome: { not: null } },
        include: { match: { select: { mode: true, finishedAt: true } } }
      })
    ]);

    const winsByPlayer = new Map<string, { wins: number; total: number }>();
    for (const p of participants) {
      if (p.match.mode !== "RANKED" || !p.match.finishedAt) continue;
      const s = winsByPlayer.get(p.userId) ?? { wins: 0, total: 0 };
      s.total++;
      if (p.outcome === "WIN") s.wins++;
      winsByPlayer.set(p.userId, s);
    }

    const byRank = new Map<string, { tier: string; division: string; count: number; wins: number; total: number }>();
    for (const r of mmrRecords) {
      const rank = r.rankDiv ? `${r.rankTier} ${r.rankDiv}`.trim() : r.rankTier;
      const entry = byRank.get(rank) ?? { tier: r.rankTier, division: r.rankDiv, count: 0, wins: 0, total: 0 };
      entry.count++;
      const ps = winsByPlayer.get(r.userId);
      if (ps) { entry.wins += ps.wins; entry.total += ps.total; }
      byRank.set(rank, entry);
    }

    const distribution: StaffRankDistributionItem[] = [...byRank.entries()]
      .map(([rank, d]) => ({
        rank,
        tier: d.tier,
        division: d.division,
        count: d.count,
        avgWinRate: d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const allStats = [...winsByPlayer.values()];
    const totalWins = allStats.reduce((s, v) => s + v.wins, 0);
    const totalGames = allStats.reduce((s, v) => s + v.total, 0);

    return {
      distribution,
      totalRankedPlayers: mmrRecords.length,
      globalAvgWinRate: totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0
    };
  }

  async getMapsAnalytics(): Promise<StaffMapsAnalyticsResponse> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const maps = await this.prisma.gameMap.findMany({
      include: {
        creator: { select: { id: true, profile: { select: { pseudo: true } } } },
        votes: { select: { value: true, createdAt: true } },
        tests: { select: { createdAt: true } },
        favorites: { select: { id: true } }
      }
    });

    type MapRow = typeof maps[0];
    const voteScore = (m: MapRow) => m.votes.reduce((s, v) => s + v.value, 0);
    const recentTests7d = (m: MapRow) => m.tests.filter(t => t.createdAt >= sevenDaysAgo).length;
    const recentActivity3d = (m: MapRow) =>
      m.votes.filter(v => v.createdAt >= threeDaysAgo).length +
      m.tests.filter(t => t.createdAt >= threeDaysAgo).length;

    const toItem = (m: MapRow): StaffMapAdminItem => ({
      id: m.id,
      title: m.title,
      creatorId: m.creatorId,
      creatorPseudo: m.creator.profile?.pseudo,
      status: m.status.toLowerCase() as MapStatus,
      popularityScore: m.popularityScore,
      reviewStatus: m.reviewStatus,
      reportCount: m.reportCount,
      voteScore: voteScore(m),
      testCount: m.tests.length,
      favoriteCount: m.favorites.length,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      lastModerationAt: m.lastModerationAt?.toISOString()
    });

    const visible = maps.filter(m => m.status !== "HIDDEN");

    const topPlayed = [...visible].sort((a, b) => recentTests7d(b) - recentTests7d(a)).slice(0, 10).map(toItem);
    const topRated = [...visible].sort((a, b) => voteScore(b) - voteScore(a)).slice(0, 10).map(toItem);
    const growing = [...visible]
      .filter(m => m.createdAt < threeDaysAgo && recentActivity3d(m) > 0)
      .sort((a, b) => recentActivity3d(b) - recentActivity3d(a))
      .slice(0, 10)
      .map(toItem);
    const abandoned = [...maps]
      .filter(m => m.createdAt < thirtyDaysAgo && recentActivity3d(m) === 0)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, 10)
      .map(toItem);

    const creatorMap = new Map<string, { pseudo?: string; mapCount: number; totalVotes: number; totalTests: number }>();
    for (const m of maps) {
      const c = creatorMap.get(m.creatorId) ?? { pseudo: m.creator.profile?.pseudo, mapCount: 0, totalVotes: 0, totalTests: 0 };
      c.mapCount++;
      c.totalVotes += voteScore(m);
      c.totalTests += m.tests.length;
      creatorMap.set(m.creatorId, c);
    }
    const activeCreators: StaffActiveCreator[] = [...creatorMap.entries()]
      .sort((a, b) => b[1].totalTests - a[1].totalTests)
      .slice(0, 10)
      .map(([creatorId, s]) => ({ creatorId, pseudo: s.pseudo, mapCount: s.mapCount, totalVotes: s.totalVotes, totalTests: s.totalTests }));

    return { topPlayed, topRated, growing, abandoned, activeCreators };
  }

  async getEconomyAnalytics(): Promise<StaffEconomyAnalyticsResponse> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [todayStats, weekStats, topItemsRaw] = await Promise.all([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: { status: "ACCEPTED", createdAt: { gte: dayAgo } }
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: { status: "ACCEPTED", createdAt: { gte: weekAgo } }
      }),
      this.prisma.transaction.groupBy({
        by: ["itemCode", "currencyType"],
        _sum: { amount: true, quantity: true },
        where: { status: "ACCEPTED", itemCode: { not: null } },
        orderBy: [{ _sum: { amount: "desc" } }],
        take: 10
      })
    ]);

    const itemCodes = topItemsRaw.map(t => t.itemCode).filter((c): c is string => c !== null);
    const storeItems = itemCodes.length > 0
      ? await this.prisma.storeItem.findMany({ where: { itemCode: { in: itemCodes } } })
      : [];
    const nameMap = new Map(storeItems.map(i => [i.itemCode, i.name]));

    const topItems: StaffEconomyItemStat[] = topItemsRaw.map(t => ({
      itemCode: t.itemCode ?? "",
      name: nameMap.get(t.itemCode ?? "") ?? (t.itemCode ?? "Unknown"),
      salesCount: t._sum.quantity ?? 0,
      revenue: t._sum.amount ?? 0,
      currencyType: t.currencyType.toLowerCase() as CurrencyType
    }));

    return {
      revenueToday: todayStats._sum.amount ?? 0,
      revenueWeek: weekStats._sum.amount ?? 0,
      salesToday: todayStats._count._all,
      salesWeek: weekStats._count._all,
      topItems
    };
  }

  // ─── Staff map management ─────────────────────────────────────────────────

  async listAdminMaps(): Promise<StaffMapAdminItem[]> {
    const maps = await this.prisma.gameMap.findMany({
      include: {
        creator: { select: { profile: { select: { pseudo: true } } } },
        votes: { select: { value: true } },
        tests: { select: { id: true } },
        favorites: { select: { id: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return maps.map(m => ({
      id: m.id,
      title: m.title,
      creatorId: m.creatorId,
      creatorPseudo: m.creator.profile?.pseudo,
      status: m.status.toLowerCase() as MapStatus,
      popularityScore: m.popularityScore,
      reviewStatus: m.reviewStatus,
      reportCount: m.reportCount,
      voteScore: m.votes.reduce((s, v) => s + v.value, 0),
      testCount: m.tests.length,
      favoriteCount: m.favorites.length,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      lastModerationAt: m.lastModerationAt?.toISOString()
    }));
  }

  // ─── Staff store management ───────────────────────────────────────────────

  async listAllStoreItems(): Promise<StoreItem[]> {
    const items = await this.prisma.storeItem.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }]
    });
    return items.map(i => this.toStoreItem(i));
  }

  async createStoreItem(actor: AuthenticatedUser, body: AdminCreateStoreItemRequest): Promise<StoreItem> {
    const item = await this.prisma.storeItem.create({
      data: {
        itemCode: body.itemCode,
        name: body.name,
        description: body.description,
        currencyType: body.currencyType.toUpperCase() as "SOFT" | "HARD",
        price: body.price,
        active: true,
        sortOrder: body.sortOrder ?? 0
      }
    });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: "admin.store.create", targetType: "store_item", targetId: item.id, metadata: { itemCode: body.itemCode } as never }
    });
    return this.toStoreItem(item);
  }

  async updateStoreItem(actor: AuthenticatedUser, itemCode: string, body: AdminUpdateStoreItemRequest): Promise<StoreItem> {
    const existing = await this.prisma.storeItem.findUnique({ where: { itemCode } });
    if (!existing) throw new NotFoundException("Store item not found.");

    const updated = await this.prisma.storeItem.update({
      where: { itemCode },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {})
      }
    });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: "admin.store.update", targetType: "store_item", targetId: updated.id, metadata: { itemCode, changes: body } as never }
    });
    return this.toStoreItem(updated);
  }

  private toStoreItem(i: { id: string; itemCode: string; name: string; description: string | null; currencyType: string; price: number; active: boolean; sortOrder: number }): StoreItem {
    return {
      id: i.id,
      itemCode: i.itemCode,
      name: i.name,
      description: i.description ?? undefined,
      currencyType: i.currencyType.toLowerCase() as CurrencyType,
      price: i.price,
      active: i.active,
      sortOrder: i.sortOrder
    };
  }

  // ─── Rank config CRUD ─────────────────────────────────────────────────────

  async listRankConfigs(): Promise<AdminRankConfigItem[]> {
    const rows = await this.prisma.rankConfig.findMany({ orderBy: [{ mode: "asc" }, { sortOrder: "asc" }] });
    return rows.map((r) => this.toRankConfigItem(r));
  }

  async createRankConfig(actor: AuthenticatedUser, body: AdminCreateRankConfigRequest): Promise<AdminRankConfigItem> {
    const modeUp = body.mode.toUpperCase() as "RANKED" | "UNRANKED" | "FUN";
    const existing = await this.prisma.rankConfig.findFirst({ where: { mode: modeUp, rank: body.rank } });
    if (existing) throw new BadRequestException(`Rank "${body.rank}" already exists for mode "${body.mode}".`);

    const row = await this.prisma.rankConfig.create({
      data: { mode: modeUp, rank: body.rank, minMmr: body.minMmr, maxMmr: body.maxMmr ?? null, sortOrder: body.sortOrder }
    });
    await Promise.all([
      this.matchmakingService.reloadRankConfigs(),
      this.prisma.auditLog.create({ data: { actorId: actor.id, action: "admin.rank.create", targetType: "rank_config", targetId: row.id, metadata: { rank: body.rank, mode: body.mode, minMmr: body.minMmr, maxMmr: body.maxMmr } as never } })
    ]);
    return this.toRankConfigItem(row);
  }

  async updateRankConfig(actor: AuthenticatedUser, id: string, body: AdminUpdateRankConfigRequest): Promise<AdminRankConfigItem> {
    const existing = await this.prisma.rankConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Rank config not found.");

    const row = await this.prisma.rankConfig.update({
      where: { id },
      data: {
        ...(body.rank !== undefined ? { rank: body.rank } : {}),
        ...(body.minMmr !== undefined ? { minMmr: body.minMmr } : {}),
        ...(body.maxMmr !== undefined ? { maxMmr: body.maxMmr } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {})
      }
    });
    await Promise.all([
      this.matchmakingService.reloadRankConfigs(),
      this.prisma.auditLog.create({ data: { actorId: actor.id, action: "admin.rank.update", targetType: "rank_config", targetId: id, metadata: { previous: { rank: existing.rank, minMmr: existing.minMmr, maxMmr: existing.maxMmr }, changes: body } as never } })
    ]);
    return this.toRankConfigItem(row);
  }

  async deleteRankConfig(actor: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.prisma.rankConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Rank config not found.");
    await this.prisma.rankConfig.delete({ where: { id } });
    await Promise.all([
      this.matchmakingService.reloadRankConfigs(),
      this.prisma.auditLog.create({ data: { actorId: actor.id, action: "admin.rank.delete", targetType: "rank_config", targetId: id, metadata: { rank: existing.rank, mode: existing.mode } as never } })
    ]);
  }

  private toRankConfigItem(r: { id: string; mode: string; rank: string; minMmr: number; maxMmr: number | null; sortOrder: number }): AdminRankConfigItem {
    return {
      id: r.id,
      mode: r.mode.toLowerCase() as GameMode,
      rank: r.rank,
      minMmr: r.minMmr,
      maxMmr: r.maxMmr ?? undefined,
      sortOrder: r.sortOrder
    };
  }

  // ─── Journal / audit ──────────────────────────────────────────────────────

  async getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { profile: { select: { pseudo: true } } } } }
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId ?? undefined,
      actorId: r.actorId,
      actorPseudo: r.actor.profile?.pseudo ?? undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? undefined,
      createdAt: r.createdAt.toISOString()
    }));
  }

  async getTransactionJournal(limit = 200): Promise<AdminTransactionJournalEntry[]> {
    const txs = await this.prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { profile: { select: { pseudo: true } } } },
        storeItem: { select: { name: true } }
      }
    });
    return txs.map((t) => ({
      id: t.id,
      playerId: t.userId,
      playerPseudo: t.user.profile?.pseudo ?? undefined,
      itemCode: t.itemCode ?? undefined,
      itemName: t.storeItem?.name ?? undefined,
      currencyType: t.currencyType.toLowerCase() as CurrencyType,
      unitPrice: t.unitPrice,
      quantity: t.quantity,
      amount: t.amount,
      status: t.status.toLowerCase() as "accepted" | "rejected",
      reason: t.reason ?? undefined,
      createdAt: t.createdAt.toISOString()
    }));
  }

  async getSanctionJournal(limit = 100): Promise<AdminSanctionEntry[]> {
    const sanctions = await this.prisma.sanction.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { profile: { select: { pseudo: true } } } }
      }
    });

    const actorIds = [...new Set(sanctions.map((s) => s.actorId).filter((id): id is string => id !== null))];
    const actorProfiles = actorIds.length > 0
      ? await this.prisma.playerProfile.findMany({ where: { userId: { in: actorIds } }, select: { userId: true, pseudo: true } })
      : [];
    const actorMap = new Map(actorProfiles.map((p) => [p.userId, p.pseudo]));

    return sanctions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userPseudo: s.user.profile?.pseudo ?? undefined,
      actorId: s.actorId ?? undefined,
      actorPseudo: s.actorId ? actorMap.get(s.actorId) ?? undefined : undefined,
      type: s.type.toLowerCase(),
      reason: s.reason,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      endsAt: s.endsAt?.toISOString() ?? undefined
    }));
  }
}
