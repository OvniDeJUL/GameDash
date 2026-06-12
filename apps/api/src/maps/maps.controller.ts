import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import type {
  CreateMapRequest,
  CreateMapVersionRequest,
  CreatorMapStatsResponse,
  FavoriteMapRequest,
  MapDetailResponse,
  MapInteractionResponse,
  MapStatsResponse,
  MapStatus,
  MapSummary,
  MapVersionResponse,
  TestMapRequest,
  VoteMapRequest
} from "@gamedash/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MapsService } from "./maps.service";

@Controller("maps")
@UseGuards(AuthGuard)
export class MapsController {
  constructor(
    @Inject(MapsService)
    private readonly mapsService: MapsService
  ) {}

  @Get()
  listMaps(
    @Query("q") q?: string,
    @Query("tag") tag?: string,
    @Query("status") status?: MapStatus,
    @Query("creatorId") creatorId?: string
  ): MapSummary[] {
    return this.mapsService.listMaps({ q, tag, status, creatorId });
  }

  @Post()
  createMap(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateMapRequest
  ): MapSummary {
    return this.mapsService.createMap(user, body);
  }

  @Get("creators/:creatorId/stats")
  getCreatorStats(@Param("creatorId") creatorId: string): CreatorMapStatsResponse {
    return this.mapsService.getCreatorStats(creatorId);
  }

  @Get(":mapId")
  getMap(@Param("mapId") mapId: string): MapDetailResponse {
    return this.mapsService.getMap(mapId);
  }

  @Get(":mapId/stats")
  getMapStats(@Param("mapId") mapId: string): MapStatsResponse {
    return this.mapsService.getMapStats(mapId);
  }

  @Post(":mapId/versions")
  createVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param("mapId") mapId: string,
    @Body() body: CreateMapVersionRequest
  ): MapVersionResponse {
    return this.mapsService.createVersion(user, mapId, body);
  }

  @Post(":mapId/votes")
  voteMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param("mapId") mapId: string,
    @Body() body: VoteMapRequest
  ): MapInteractionResponse {
    return this.mapsService.voteMap(user, mapId, body);
  }

  @Post(":mapId/tests")
  testMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param("mapId") mapId: string,
    @Body() body: TestMapRequest
  ): MapInteractionResponse {
    return this.mapsService.testMap(user, mapId, body);
  }

  @Post(":mapId/favorites")
  favoriteMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param("mapId") mapId: string,
    @Body() body: FavoriteMapRequest
  ): MapInteractionResponse {
    return this.mapsService.favoriteMap(user, mapId, body);
  }
}
