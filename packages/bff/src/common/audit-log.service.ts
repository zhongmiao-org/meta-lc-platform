import { Injectable, Logger } from "@nestjs/common";
import { AuditPersistenceService } from "../integration/audit-persistence.service";

export interface QueryAuditPayload {
  requestId: string;
  tenantId: string;
  userId: string;
  table?: string;
  queryDsl?: string;
  finalSql?: string;
  durationMs: number;
  resultCount?: number;
  error?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger("AuditLog");

  constructor(private readonly auditPersistenceService: AuditPersistenceService) {}

  async logQuerySuccess(payload: QueryAuditPayload): Promise<void> {
    this.logger.log(
      JSON.stringify({
        event: "query.success",
        timestamp: new Date().toISOString(),
        ...payload
      })
    );
    try {
      await this.auditPersistenceService.persist({
        requestId: payload.requestId,
        tenantId: payload.tenantId,
        userId: payload.userId,
        tableName: payload.table ?? null,
        queryDsl: payload.queryDsl ?? null,
        finalSql: payload.finalSql ?? null,
        durationMs: payload.durationMs,
        resultCount: payload.resultCount ?? null,
        status: "success",
        errorMessage: null
      });
    } catch (error) {
      this.logger.warn(
        `persist success audit failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async logQueryFailure(payload: QueryAuditPayload): Promise<void> {
    this.logger.error(
      JSON.stringify({
        event: "query.failure",
        timestamp: new Date().toISOString(),
        ...payload
      })
    );
    try {
      await this.auditPersistenceService.persist({
        requestId: payload.requestId,
        tenantId: payload.tenantId,
        userId: payload.userId,
        tableName: payload.table ?? null,
        queryDsl: payload.queryDsl ?? null,
        finalSql: payload.finalSql ?? null,
        durationMs: payload.durationMs,
        resultCount: null,
        status: "failure",
        errorMessage: payload.error ?? null
      });
    } catch (error) {
      this.logger.warn(
        `persist failure audit failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
