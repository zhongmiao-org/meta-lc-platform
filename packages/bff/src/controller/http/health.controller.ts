import { Controller, Get } from "@nestjs/common";
import { HealthService } from "../../application/services/health.service";

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("health")
  health(): Promise<{ ok: boolean }> {
    return this.healthService.check();
  }
}
