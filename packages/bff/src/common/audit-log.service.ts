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
  permissionScope?: string | null;
  permissionOrgCount?: number | null;
  permissionFallbackUsed?: boolean | null;
  permissionReason?: string | null;
}

export interface MutationAuditPayload {
  requestId: string;
  tenantId: string;
  userId: string;
  table: string;
  operation: string;
  durationMs: number;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  error?: string;
  permissionScope?: string | null;
  permissionOrgCount?: number | null;
  permissionFallbackUsed?: boolean | null;
  permissionReason?: string | null;
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
        errorMessage: null,
        permissionScope: payload.permissionScope ?? null,
        permissionOrgCount: payload.permissionOrgCount ?? null,
        permissionFallbackUsed: payload.permissionFallbackUsed ?? null,
        permissionReason: payload.permissionReason ?? null
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
        status: payload.error === "data scope permission denied" ? "denied" : "failure",
        errorMessage: payload.error ?? null,
        permissionScope: payload.permissionScope ?? null,
        permissionOrgCount: payload.permissionOrgCount ?? null,
        permissionFallbackUsed: payload.permissionFallbackUsed ?? null,
        permissionReason: payload.permissionReason ?? null
      });
    } catch (error) {
      this.logger.warn(
        `persist failure audit failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async logMutationSuccess(payload: MutationAuditPayload): Promise<void> {
    this.logger.log(
      JSON.stringify({
        event: "mutation.success",
        timestamp: new Date().toISOString(),
        ...payload
      })
    );
    try {
      await this.auditPersistenceService.persistMutation({
        requestId: payload.requestId,
        tenantId: payload.tenantId,
        userId: payload.userId,
        tableName: payload.table,
        operation: payload.operation,
        beforeData: payload.beforeData ?? null,
        afterData: payload.afterData ?? null,
        durationMs: payload.durationMs,
        status: "success",
        errorMessage: null,
        permissionScope: payload.permissionScope ?? null,
        permissionOrgCount: payload.permissionOrgCount ?? null,
        permissionFallbackUsed: payload.permissionFallbackUsed ?? null,
        permissionReason: payload.permissionReason ?? null
      });
    } catch (error) {
      this.logger.warn(
        `persist mutation success audit failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async logMutationFailure(payload: MutationAuditPayload): Promise<void> {
    this.logger.error(
      JSON.stringify({
        event: "mutation.failure",
        timestamp: new Date().toISOString(),
        ...payload
      })
    );
    try {
      await this.auditPersistenceService.persistMutation({
        requestId: payload.requestId,
        tenantId: payload.tenantId,
        userId: payload.userId,
        tableName: payload.table,
        operation: payload.operation,
        beforeData: payload.beforeData ?? null,
        afterData: payload.afterData ?? null,
        durationMs: payload.durationMs,
        status: payload.error === "data scope permission denied" ? "denied" : "failure",
        errorMessage: payload.error ?? null,
        permissionScope: payload.permissionScope ?? null,
        permissionOrgCount: payload.permissionOrgCount ?? null,
        permissionFallbackUsed: payload.permissionFallbackUsed ?? null,
        permissionReason: payload.permissionReason ?? null
      });
    } catch (error) {
      this.logger.warn(
        `persist mutation failure audit failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
