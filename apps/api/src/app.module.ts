import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth/auth.guard";
import { AdminController } from "./admin/admin.controller";
import { AdminService } from "./admin/admin.service";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { EconomyController } from "./economy/economy.controller";
import { EconomyService } from "./economy/economy.service";
import { HealthController } from "./health/health.controller";
import { MapsController } from "./maps/maps.controller";
import { MapsService } from "./maps/maps.service";
import { MatchmakingController } from "./matchmaking/matchmaking.controller";
import { MatchmakingService } from "./matchmaking/matchmaking.service";
import { MatchesController } from "./matches/matches.controller";
import { PlayersController } from "./players/players.controller";
import { ProgressionService } from "./progression/progression.service";
import {
  AdminMonitoringGateway,
  MatchmakingGateway,
  PlayerStatusGateway
} from "./realtime/realtime.gateway";
import { RolesGuard } from "./auth/roles.guard";

@Module({
  imports: [],
  controllers: [
    HealthController,
    AuthController,
    PlayersController,
    MatchmakingController,
    MatchesController,
    EconomyController,
    MapsController,
    AdminController
  ],
  providers: [
    AdminService,
    AuthService,
    MatchmakingService,
    ProgressionService,
    EconomyService,
    MapsService,
    AuthGuard,
    RolesGuard,
    MatchmakingGateway,
    PlayerStatusGateway,
    AdminMonitoringGateway
  ]
})
export class AppModule {}
