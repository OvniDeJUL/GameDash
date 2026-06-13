import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  AccountModerationRequest,
  AdminDashboardSummary,
  MapModerationRequest,
  ModerationActionResponse,
  ModerationSignalResponse,
  StudioSettingsResponse,
  UpdateStudioSettingsRequest
} from "@gamedash/contracts";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_SETTINGS: StudioSettingsResponse = {
  matchmaking: { rankedQueueMaxWaitSeconds: 90, funQueueMaxWaitSeconds: 45, matchSize: 2 },
  mmr: { placementMmr: 1000, rankedWinDelta: 32, rankedLossDelta: -24, unrankedWinDelta: 10, unrankedLossDelta: -8 },
  economy: { starterSoftBalance: 1000, starterHardBalance: 20, purchaseEnabled: true, refundWindowHours: 24 },
  updatedAt: new Date(0).toISOString()
};

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
        where: { key: "__meta" },
        create: { key: "__meta", value: { updatedAt: next.updatedAt, updatedBy: actor.id }, updatedById: actor.id },
        update: { value: { updatedAt: next.updatedAt, updatedBy: actor.id }, updatedById: actor.id }
      })
    ]);

    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: "admin.settings.update", targetType: "studio_settings", targetId: "global", metadata: { sections: Object.keys(body) } as never }
    });

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

  private async loadSettings(): Promise<StudioSettingsResponse> {
    const rows = await this.prisma.studioSetting.findMany({ where: { key: { in: ["matchmaking", "mmr", "economy", "__meta"] } } });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const meta = byKey["__meta"] as { updatedAt?: string; updatedBy?: string } | undefined;

    return {
      matchmaking: (byKey["matchmaking"] as unknown as StudioSettingsResponse["matchmaking"]) ?? DEFAULT_SETTINGS.matchmaking,
      mmr: (byKey["mmr"] as unknown as StudioSettingsResponse["mmr"]) ?? DEFAULT_SETTINGS.mmr,
      economy: (byKey["economy"] as unknown as StudioSettingsResponse["economy"]) ?? DEFAULT_SETTINGS.economy,
      updatedAt: meta?.updatedAt ?? DEFAULT_SETTINGS.updatedAt,
      updatedBy: meta?.updatedBy
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
}
