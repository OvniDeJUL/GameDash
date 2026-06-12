import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type {
  AccountModerationRequest,
  AdminDashboardSummary,
  MapModerationRequest,
  ModerationActionResponse,
  ModerationSignalResponse,
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
  getDashboard(): AdminDashboardSummary {
    return this.adminService.getDashboard();
  }

  @Get("settings")
  @Roles("staff", "admin")
  getSettings(): StudioSettingsResponse {
    return this.adminService.getSettings();
  }

  @Patch("settings")
  @Roles("admin")
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateStudioSettingsRequest
  ): StudioSettingsResponse {
    return this.adminService.updateSettings(user, body);
  }

  @Get("moderation/signals")
  @Roles("staff", "admin")
  getModerationSignals(): ModerationSignalResponse[] {
    return this.adminService.getModerationSignals();
  }

  @Get("moderation/history")
  @Roles("staff", "admin")
  getModerationHistory(): ModerationActionResponse[] {
    return this.adminService.getModerationHistory();
  }

  @Post("moderation/accounts/:userId/actions")
  @Roles("staff", "admin")
  moderateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() body: AccountModerationRequest
  ): ModerationActionResponse {
    return this.adminService.moderateAccount(user, userId, body);
  }

  @Post("moderation/maps/:mapId/actions")
  @Roles("staff", "admin")
  moderateMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param("mapId") mapId: string,
    @Body() body: MapModerationRequest
  ): ModerationActionResponse {
    return this.adminService.moderateMap(user, mapId, body);
  }
}
