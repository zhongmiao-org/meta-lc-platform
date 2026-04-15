import { Body, Controller, Get, Post } from "@nestjs/common";
import { QueryOrchestratorService } from "./orchestration/query-orchestrator.service";
import type { QueryApiRequest } from "./types";

@Controller()
export class AppController {
  constructor(private readonly queryOrchestrator: QueryOrchestratorService) {}

  @Get("health")
  async health(): Promise<{ ok: boolean }> {
    const ok = await this.queryOrchestrator.health();
    return { ok };
  }

  @Post("query")
  async query(@Body() request: QueryApiRequest): Promise<{ rows: Record<string, unknown>[] }> {
    const result = await this.queryOrchestrator.execute(request);
    return { rows: result.rows };
  }
}
