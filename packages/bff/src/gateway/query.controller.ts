import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { AuditLogService } from "../common/audit-log.service";
import { resolveRequestId } from "../common/request-id";
import { QueryOrchestratorService } from "../orchestration/query-orchestrator.service";
import type { QueryApiRequest } from "../types";

@Controller()
export class QueryController {
  constructor(
    private readonly queryOrchestrator: QueryOrchestratorService,
    private readonly auditLogService: AuditLogService
  ) {}

  @Get("health")
  async health(): Promise<{ ok: boolean }> {
    const ok = await this.queryOrchestrator.health();
    return { ok };
  }

  @Post("query")
  async query(
    @Body() request: QueryApiRequest,
    @Req()
    req: {
      headers: Record<string, string | string[] | undefined>;
    },
    @Res({ passthrough: true })
    res: {
      setHeader(name: string, value: string): void;
    }
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    res.setHeader("x-request-id", requestId);

    const startedAt = Date.now();
    const queryDsl = JSON.stringify({
      table: request.table,
      fields: request.fields,
      filters: request.filters ?? {},
      limit: request.limit ?? 100
    });
    try {
      const result = await this.queryOrchestrator.execute(request);
      await this.auditLogService.logQuerySuccess({
        requestId,
        tenantId: request.tenantId,
        userId: request.userId,
        table: request.table,
        queryDsl,
        finalSql: result.finalSql,
        durationMs: Date.now() - startedAt,
        resultCount: result.rows.length
      });
      return { rows: result.rows };
    } catch (error) {
      await this.auditLogService.logQueryFailure({
        requestId,
        tenantId: request.tenantId,
        userId: request.userId,
        table: request.table,
        queryDsl,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "unknown_error"
      });
      throw error;
    }
  }
}
