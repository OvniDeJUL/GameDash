import { Controller, Get, Inject } from "@nestjs/common";
import type { HealthResponse } from "@gamedash/contracts";
import { ObservabilityService } from "../observability/observability.service";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(ObservabilityService)
    private readonly observabilityService: ObservabilityService
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return this.observabilityService.getHealth();
  }
}
