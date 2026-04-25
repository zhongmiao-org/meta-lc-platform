import { Controller, Get } from "@nestjs/common";
import { PostgresQueryExecutorService } from "../../infra/integration/postgres-query.service";

@Controller()
export class HealthController {
  constructor(private readonly queryExecutor: PostgresQueryExecutorService) {}

  @Get("health")
  health(): Promise<{ ok: boolean }> {
    return this.check();
  }

  private async check(): Promise<{ ok: boolean }> {
    return {
      ok: await this.queryExecutor.health()
    };
  }
}
