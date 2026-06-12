import { BadRequestException, Injectable } from "@nestjs/common";
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

interface AdminAuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const DEFAULT_SETTINGS: StudioSettingsResponse = {
  matchmaking: {
    rankedQueueMaxWaitSeconds: 90,
    funQueueMaxWaitSeconds: 45,
    matchSize: 2
  },
  mmr: {
    placementMmr: 1000,
    rankedWinDelta: 32,
    rankedLossDelta: -24,
    unrankedWinDelta: 10,
    unrankedLossDelta: -8
  },
  economy: {
    starterSoftBalance: 1000,
    starterHardBalance: 20,
    purchaseEnabled: true,
    refundWindowHours: 24
  },
  updatedAt: new Date(0).toISOString()
};

@Injectable()
export class AdminService {
  private settings: StudioSettingsResponse = { ...DEFAULT_SETTINGS };
  private readonly moderationActions: ModerationActionResponse[] = [];
  private readonly moderationSignals: ModerationSignalResponse[] = [
    {
      id: "sig_map_report_spam",
      targetType: "map",
      targetId: "map_reported_spam",
      reason: "Repeated low-quality map reports",
      status: "open",
      source: "map_report",
      createdAt: new Date(0).toISOString()
    },
    {
      id: "sig_account_abuse",
      targetType: "account",
      targetId: "usr_reported_abuse",
      reason: "Multiple player reports in ranked queue",
      status: "open",
      source: "player_report",
      createdAt: new Date(0).toISOString()
    }
  ];
  private readonly auditLogs: AdminAuditEntry[] = [];

  getDashboard(): AdminDashboardSummary {
    return {
      activePlayers: 1200,
      dailyMatches: 9800,
      virtualRevenue: 45200,
      mapActivity: 310,
      openModerationSignals: this.moderationSignals.filter((signal) => signal.status === "open").length,
      activeSanctions: this.moderationActions.filter((action) =>
        action.action === "account.suspend" || action.action === "account.ban"
      ).length,
      settingsLastUpdated: this.settings.updatedAt
    };
  }

  getSettings(): StudioSettingsResponse {
    return this.cloneSettings();
  }

  updateSettings(actor: AuthenticatedUser, body: UpdateStudioSettingsRequest): StudioSettingsResponse {
    const nextSettings: StudioSettingsResponse = {
      matchmaking: {
        ...this.settings.matchmaking,
        ...body.matchmaking
      },
      mmr: {
        ...this.settings.mmr,
        ...body.mmr
      },
      economy: {
        ...this.settings.economy,
        ...body.economy
      },
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id
    };
    this.assertSettings(nextSettings);

    this.settings = nextSettings;
    this.audit(actor.id, "admin.settings.update", "studio_settings", "global", {
      sections: Object.keys(body)
    });

    return this.cloneSettings();
  }

  moderateAccount(
    actor: AuthenticatedUser,
    targetUserId: string,
    body: AccountModerationRequest
  ): ModerationActionResponse {
    const reason = this.assertReason(body.reason);
    if (body.durationHours !== undefined && body.durationHours < 0) {
      throw new BadRequestException("Moderation duration cannot be negative.");
    }
    const action = `account.${body.action}`;
    const createdAt = new Date().toISOString();
    const expiresAt =
      body.durationHours && body.durationHours > 0
        ? new Date(Date.now() + body.durationHours * 60 * 60 * 1000).toISOString()
        : undefined;
    const response: ModerationActionResponse = {
      id: randomUUID(),
      targetType: "account",
      targetId: targetUserId,
      action,
      reason,
      actorId: actor.id,
      createdAt,
      expiresAt
    };
    this.moderationActions.unshift(response);
    this.audit(actor.id, "admin.moderation.account", "account", targetUserId, {
      action,
      reason,
      expiresAt
    });

    return response;
  }

  moderateMap(
    actor: AuthenticatedUser,
    mapId: string,
    body: MapModerationRequest
  ): ModerationActionResponse {
    const reason = this.assertReason(body.reason);
    const action = `map.${body.action}`;
    const response: ModerationActionResponse = {
      id: randomUUID(),
      targetType: "map",
      targetId: mapId,
      action,
      reason,
      actorId: actor.id,
      createdAt: new Date().toISOString()
    };
    this.moderationActions.unshift(response);
    this.audit(actor.id, "admin.moderation.map", "map", mapId, {
      action,
      reason
    });

    return response;
  }

  getModerationHistory(): ModerationActionResponse[] {
    return [...this.moderationActions];
  }

  getModerationSignals(): ModerationSignalResponse[] {
    return [...this.moderationSignals];
  }

  getAuditLogs(): AdminAuditEntry[] {
    return [...this.auditLogs];
  }

  private cloneSettings(): StudioSettingsResponse {
    return {
      matchmaking: { ...this.settings.matchmaking },
      mmr: { ...this.settings.mmr },
      economy: { ...this.settings.economy },
      updatedAt: this.settings.updatedAt,
      updatedBy: this.settings.updatedBy
    };
  }

  private assertReason(reason: string): string {
    const normalized = reason.trim();
    if (!normalized) {
      throw new BadRequestException("Moderation reason is required.");
    }

    return normalized;
  }

  private assertSettings(settings: StudioSettingsResponse): void {
    if (settings.matchmaking.matchSize < 2) {
      throw new BadRequestException("Match size must be at least 2.");
    }
    if (settings.economy.starterSoftBalance < 0 || settings.economy.starterHardBalance < 0) {
      throw new BadRequestException("Starter balances cannot be negative.");
    }
    if (settings.economy.refundWindowHours < 0) {
      throw new BadRequestException("Refund window cannot be negative.");
    }
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
