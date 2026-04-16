import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ForbiddenDataScopeError } from "../common/permission-errors";
import { AuditLogService } from "../common/audit-log.service";
import { resolveRequestId } from "../common/request-id";
import { MutationOrchestratorService } from "../orchestration/mutation-orchestrator.service";
import { QueryOrchestratorService } from "../orchestration/query-orchestrator.service";
import type { MutationApiRequest, QueryApiRequest } from "../types";

@Controller()
export class QueryController {
  constructor(
    private readonly queryOrchestrator: QueryOrchestratorService,
    private readonly mutationOrchestrator: MutationOrchestratorService,
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
        resultCount: result.rows.length,
        permissionScope: result.permissionDecision.scope,
        permissionOrgCount: result.permissionDecision.allowedOrgIds.length,
        permissionFallbackUsed: result.permissionDecision.legacyFallbackToCreatedBy,
        permissionReason: result.permissionDecision.reason
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
        error: error instanceof Error ? error.message : "unknown_error",
        permissionScope: error instanceof ForbiddenDataScopeError ? error.details.decision.scope : null,
        permissionOrgCount:
          error instanceof ForbiddenDataScopeError ? error.details.decision.allowedOrgIds.length : null,
        permissionFallbackUsed:
          error instanceof ForbiddenDataScopeError
            ? error.details.decision.legacyFallbackToCreatedBy
            : null,
        permissionReason: error instanceof ForbiddenDataScopeError ? error.details.reason : null
      });
      throw error;
    }
  }

  @Post("mutation")
  async mutation(
    @Body() request: MutationApiRequest,
    @Req()
    req: {
      headers: Record<string, string | string[] | undefined>;
    },
    @Res({ passthrough: true })
    res: {
      setHeader(name: string, value: string): void;
    }
  ): Promise<{ rowCount: number; row: Record<string, unknown> | null }> {
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    res.setHeader("x-request-id", requestId);

    const startedAt = Date.now();
    try {
      const result = await this.mutationOrchestrator.execute(request);
      await this.auditLogService.logMutationSuccess({
        requestId,
        tenantId: request.tenantId,
        userId: request.userId,
        table: request.table,
        operation: request.operation,
        durationMs: Date.now() - startedAt,
        beforeData: result.beforeData,
        afterData: result.afterData,
        permissionScope: result.permissionDecision.scope,
        permissionOrgCount: result.permissionDecision.allowedOrgIds.length,
        permissionFallbackUsed: result.permissionDecision.legacyFallbackToCreatedBy,
        permissionReason: result.permissionDecision.reason
      });
      return {
        rowCount: result.rowCount,
        row: result.afterData ?? result.beforeData
      };
    } catch (error) {
      await this.auditLogService.logMutationFailure({
        requestId,
        tenantId: request.tenantId,
        userId: request.userId,
        table: request.table,
        operation: request.operation,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "unknown_error",
        permissionScope: error instanceof ForbiddenDataScopeError ? error.details.decision.scope : null,
        permissionOrgCount:
          error instanceof ForbiddenDataScopeError ? error.details.decision.allowedOrgIds.length : null,
        permissionFallbackUsed:
          error instanceof ForbiddenDataScopeError
            ? error.details.decision.legacyFallbackToCreatedBy
            : null,
        permissionReason: error instanceof ForbiddenDataScopeError ? error.details.reason : null
      });
      throw error;
    }
  }
}
