import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import type { QueueJoinRequest, QueueStatusResponse } from "@gamedash/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MatchmakingService } from "./matchmaking.service";

@Controller("matchmaking/queue")
@UseGuards(AuthGuard)
export class MatchmakingController {
  constructor(
    @Inject(MatchmakingService)
    private readonly matchmakingService: MatchmakingService
  ) {}

  @Post("join")
  joinQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: QueueJoinRequest
  ): Promise<QueueStatusResponse> {
    return this.matchmakingService.joinQueue(user, body);
  }

  @Post("leave")
  leaveQueue(@CurrentUser() user: AuthenticatedUser): QueueStatusResponse {
    return this.matchmakingService.leaveQueue(user);
  }

  @Get("status")
  queueStatus(@CurrentUser() user: AuthenticatedUser): QueueStatusResponse {
    return this.matchmakingService.getQueueStatus(user);
  }
}
