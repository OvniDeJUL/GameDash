import { Body, Controller, Get, Inject, Param, Patch, UseGuards } from "@nestjs/common";
import type {
  MatchHistoryItem,
  PlayerProfileResponse,
  PlayerMmrResponse,
  PlayerProgressionResponse,
  ProgressionRulesResponse,
  LevelReward,
  RankConfig,
  UpdatePlayerProfileRequest
} from "@gamedash/contracts";
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
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(MatchmakingService)
    private readonly matchmakingService: MatchmakingService,
    @Inject(ProgressionService)
    private readonly progressionService: ProgressionService
  ) {}

  @Get("me/profile")
  getMyProfile(@CurrentUser() user: AuthenticatedUser): Promise<PlayerProfileResponse> {
    return this.authService.getProfile(user);
  }

  @Patch("me/profile")
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdatePlayerProfileRequest
  ): Promise<PlayerProfileResponse> {
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
  getPlayerMmr(@Param("playerId") playerId: string): Promise<PlayerMmrResponse> {
    return this.matchmakingService.getPlayerMmr(playerId);
  }

  @Get(":playerId/matches")
  getPlayerMatches(@Param("playerId") playerId: string): Promise<MatchHistoryItem[]> {
    return this.matchmakingService.getPlayerMatches(playerId);
  }

  @Get(":playerId/progression")
  getPlayerProgression(@Param("playerId") playerId: string): Promise<PlayerProgressionResponse> {
    return this.progressionService.getPlayerProgression(playerId);
  }
}
