import { Body, Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";
import type { MatchResultRequest, MatchResultResponse } from "@gamedash/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MatchmakingService } from "../matchmaking/matchmaking.service";

@Controller("matches")
@UseGuards(AuthGuard)
export class MatchesController {
  constructor(
    @Inject(MatchmakingService)
    private readonly matchmakingService: MatchmakingService
  ) {}

  @Post(":matchId/result")
  submitResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param("matchId") matchId: string,
    @Body() body: MatchResultRequest
  ): Promise<MatchResultResponse> {
    return this.matchmakingService.submitResult(user, matchId, body);
  }
}
