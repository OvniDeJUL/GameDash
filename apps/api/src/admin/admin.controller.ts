import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type {
  AccountModerationRequest,
  AdminActivePlayerStatus,
  AdminCreateRankConfigRequest,
  AdminCreateStoreItemRequest,
  AdminDashboardSummary,
  AdminMatchDetail,
  AdminPlayerResponse,
  AdminPlayerTimeline,
  AdminQueueSnapshot,
  AdminRankConfigItem,
  AdminSanctionEntry,
  AdminTransactionJournalEntry,
  AdminUpdatePlayerRequest,
  AdminUpdateRankConfigRequest,
  AdminUpdateStoreItemRequest,
  AuditLogEntry,
  MapModerationRequest,
  MapReportItem,
  ModerationActionResponse,
  ModerationSignalResponse,
  StaffEconomyAnalyticsResponse,
  StaffMapAdminItem,
  StaffMapsAnalyticsResponse,
  StaffRankAnalyticsResponse,
  StoreItem,
  StudioSettingsResponse,
  UpdateStudioSettingsRequest
} from "@gamedash/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(AuthGuard, RolesGuard)
export class AdminController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService
  ) {}

  @Get("dashboard")
  @Roles("staff", "admin")
  getDashboard(): Promise<AdminDashboardSummary> {
    return this.adminService.getDashboard();
  }

  @Get("settings")
  @Roles("staff", "admin")
  getSettings(): Promise<StudioSettingsResponse> {
    return this.adminService.getSettings();
  }

  @Patch("settings")
  @Roles("admin")
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateStudioSettingsRequest
  ): Promise<StudioSettingsResponse> {
    return this.adminService.updateSettings(user, body);
  }

  @Get("players")
  @Roles("staff", "admin")
  listPlayers(): Promise<AdminPlayerResponse[]> {
    return this.adminService.listPlayers();
  }

  @Patch("players/:userId")
  @Roles("admin")
  updatePlayer(
    @Param("userId") userId: string,
    @Body() body: AdminUpdatePlayerRequest
  ): Promise<AdminPlayerResponse> {
    return this.adminService.updatePlayer(userId, body);
  }

  @Get("players/:userId/timeline")
  @Roles("staff", "admin")
  getPlayerTimeline(@Param("userId") userId: string): Promise<AdminPlayerTimeline> {
    return this.adminService.getPlayerTimeline(userId);
  }

  @Get("moderation/signals")
  @Roles("staff", "admin")
  getModerationSignals(): Promise<ModerationSignalResponse[]> {
    return this.adminService.getModerationSignals();
  }

  @Get("moderation/history")
  @Roles("staff", "admin")
  getModerationHistory(): Promise<ModerationActionResponse[]> {
    return this.adminService.getModerationHistory();
  }

  @Post("moderation/accounts/:userId/actions")
  @Roles("staff", "admin")
  moderateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() body: AccountModerationRequest
  ): Promise<ModerationActionResponse> {
    return this.adminService.moderateAccount(user, userId, body);
  }

  @Post("moderation/maps/:mapId/actions")
  @Roles("staff", "admin")
  moderateMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param("mapId") mapId: string,
    @Body() body: MapModerationRequest
  ): Promise<ModerationActionResponse> {
    return this.adminService.moderateMap(user, mapId, body);
  }

  @Get("moderation/map-reports")
  @Roles("staff", "admin")
  getMapReports(): Promise<MapReportItem[]> {
    return this.adminService.getMapReports();
  }

  @Patch("moderation/map-reports/:id")
  @Roles("staff", "admin")
  @HttpCode(204)
  dismissMapReport(
    @Param("id") id: string,
    @Body() body: { action: "reviewed" | "dismissed" }
  ): Promise<void> {
    return this.adminService.dismissMapReport(id, body.action ?? "dismissed");
  }

  // ─── Matchmaking live view ────────────────────────────────────────────────

  @Get("matchmaking/queue")
  @Roles("staff", "admin")
  getQueueSnapshot(): Promise<AdminQueueSnapshot> {
    return this.adminService.getQueueSnapshot();
  }

  // ─── Overview drill-downs ─────────────────────────────────────────────────

  @Get("players/active-status")
  @Roles("staff", "admin")
  getActivePlayerStatuses(): Promise<AdminActivePlayerStatus[]> {
    return this.adminService.getActivePlayerStatuses();
  }

  @Get("matches/today")
  @Roles("staff", "admin")
  getDailyMatches(): Promise<AdminMatchDetail[]> {
    return this.adminService.getDailyMatches();
  }

  // ─── Staff analytics ──────────────────────────────────────────────────────

  @Get("analytics/ranks")
  @Roles("staff", "admin")
  getRankAnalytics(): Promise<StaffRankAnalyticsResponse> {
    return this.adminService.getRankAnalytics();
  }

  @Get("analytics/maps")
  @Roles("staff", "admin")
  getMapsAnalytics(): Promise<StaffMapsAnalyticsResponse> {
    return this.adminService.getMapsAnalytics();
  }

  @Get("analytics/economy")
  @Roles("staff", "admin")
  getEconomyAnalytics(): Promise<StaffEconomyAnalyticsResponse> {
    return this.adminService.getEconomyAnalytics();
  }

  // ─── Staff map management ─────────────────────────────────────────────────

  @Get("maps")
  @Roles("staff", "admin")
  listAdminMaps(): Promise<StaffMapAdminItem[]> {
    return this.adminService.listAdminMaps();
  }

  // ─── Staff store management ───────────────────────────────────────────────

  @Get("economy/store")
  @Roles("staff", "admin")
  listStoreItems(): Promise<StoreItem[]> {
    return this.adminService.listAllStoreItems();
  }

  @Post("economy/store")
  @Roles("staff", "admin")
  createStoreItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdminCreateStoreItemRequest
  ): Promise<StoreItem> {
    return this.adminService.createStoreItem(user, body);
  }

  @Patch("economy/store/:itemCode")
  @Roles("staff", "admin")
  updateStoreItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("itemCode") itemCode: string,
    @Body() body: AdminUpdateStoreItemRequest
  ): Promise<StoreItem> {
    return this.adminService.updateStoreItem(user, itemCode, body);
  }

  // ─── Rank config CRUD ─────────────────────────────────────────────────────

  @Get("ranks")
  @Roles("staff", "admin")
  listRankConfigs(): Promise<AdminRankConfigItem[]> {
    return this.adminService.listRankConfigs();
  }

  @Post("ranks")
  @Roles("staff", "admin")
  createRankConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdminCreateRankConfigRequest
  ): Promise<AdminRankConfigItem> {
    return this.adminService.createRankConfig(user, body);
  }

  @Patch("ranks/:id")
  @Roles("staff", "admin")
  updateRankConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: AdminUpdateRankConfigRequest
  ): Promise<AdminRankConfigItem> {
    return this.adminService.updateRankConfig(user, id, body);
  }

  @Delete("ranks/:id")
  @Roles("staff", "admin")
  @HttpCode(204)
  deleteRankConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<void> {
    return this.adminService.deleteRankConfig(user, id);
  }

  // ─── Journal / audit ──────────────────────────────────────────────────────

  @Get("audit/logs")
  @Roles("staff", "admin")
  getAuditLogs(@Query("limit") limit?: string): Promise<AuditLogEntry[]> {
    return this.adminService.getAuditLogs(limit ? Number(limit) : undefined);
  }

  @Get("audit/transactions")
  @Roles("staff", "admin")
  getTransactionJournal(@Query("limit") limit?: string): Promise<AdminTransactionJournalEntry[]> {
    return this.adminService.getTransactionJournal(limit ? Number(limit) : undefined);
  }

  @Get("audit/sanctions")
  @Roles("staff", "admin")
  getSanctionJournal(@Query("limit") limit?: string): Promise<AdminSanctionEntry[]> {
    return this.adminService.getSanctionJournal(limit ? Number(limit) : undefined);
  }
}
