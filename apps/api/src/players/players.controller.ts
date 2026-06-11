import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import type {
  MatchHistoryItem,
  PlayerProfileResponse,
  PlayerMmrResponse,
  PlayerProgressionResponse,
  ProgressionRulesResponse,
  LevelReward,
  RankConfig
} from "@gamedash/contracts";
import type { UpdatePlayerProfileRequest } from "@gamedash/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MatchmakingService } from "../matchmaking/matchmaking.service";
import { ProgressionService } from "../progression/progression.service";

@Controller("players")
@UseGuards(AuthGuard)
export class PlayersController {
  constructor(
    private readonly authService: AuthService,
    private readonly matchmakingService: MatchmakingService,
    private readonly progressionService: ProgressionService
  ) {}

  @Get("me/profile")
  getMyProfile(@CurrentUser() user: AuthenticatedUser): PlayerProfileResponse {
    return this.authService.getProfile(user);
  }

  @Patch("me/profile")
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdatePlayerProfileRequest
  ): PlayerProfileResponse {
    return this.authService.updateProfile(user, body);
  }

  @Get("ranks/config")
  getRankConfig(): RankConfig[] {
    return this.matchmakingService.getRankConfig();
  }

  @Get("progression/rewards")
  getProgressionRewards(): LevelReward[] {
    return this.progressionService.getLevelRewards();
  }

  @Get("progression/rules")
  getProgressionRules(): ProgressionRulesResponse {
    return this.progressionService.getProgressionRules();
  }

  @Get(":playerId/mmr")
  getPlayerMmr(@Param("playerId") playerId: string): PlayerMmrResponse {
    return this.matchmakingService.getPlayerMmr(playerId);
  }

  @Get(":playerId/matches")
  getPlayerMatches(@Param("playerId") playerId: string): MatchHistoryItem[] {
    return this.matchmakingService.getPlayerMatches(playerId);
  }

  @Get(":playerId/progression")
  getPlayerProgression(@Param("playerId") playerId: string): PlayerProgressionResponse {
    return this.progressionService.getPlayerProgression(playerId);
  }
}
