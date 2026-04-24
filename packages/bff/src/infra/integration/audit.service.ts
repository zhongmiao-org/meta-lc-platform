import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { RuntimeAuditEvent } from "@zhongmiao/meta-lc-audit";
import { Pool } from "pg";
import { loadDbTargets } from "../../config/config";
import type {
  MutationAuditRecord,
  QueryAuditRecord
} from "../types/audit.type";

@Injectable()
export class AuditPersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("AuditPersistence");
  private readonly pool: Pool;

  constructor() {
    const config = loadDbTargets().audit;
    this.pool = new Pool({
      connectionString: config.url,
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS query_logs (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        table_name TEXT NULL,
        query_dsl TEXT NULL,
        final_sql TEXT NULL,
        duration_ms INTEGER NOT NULL,
        result_count INTEGER NULL,
        status TEXT NOT NULL,
        error_message TEXT NULL,
        permission_scope TEXT NULL,
        permission_org_count INTEGER NULL,
        permission_fallback_used BOOLEAN NULL,
        permission_reason TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS mutation_logs (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        before_data JSONB NULL,
        after_data JSONB NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'success',
        error_message TEXT NULL,
        permission_scope TEXT NULL,
        permission_org_count INTEGER NULL,
        permission_fallback_used BOOLEAN NULL,
        permission_reason TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      ALTER TABLE query_logs
      ADD COLUMN IF NOT EXISTS permission_scope TEXT NULL
    `);
    await this.pool.query(`
      ALTER TABLE query_logs
      ADD COLUMN IF NOT EXISTS permission_org_count INTEGER NULL
    `);
    await this.pool.query(`
      ALTER TABLE query_logs
      ADD COLUMN IF NOT EXISTS permission_fallback_used BOOLEAN NULL
    `);
    await this.pool.query(`
      ALTER TABLE query_logs
      ADD COLUMN IF NOT EXISTS permission_reason TEXT NULL
    `);
    await this.pool.query(`
      ALTER TABLE mutation_logs
      ADD COLUMN IF NOT EXISTS duration_ms INTEGER NOT NULL DEFAULT 0
    `);
    await this.pool.query(`
      ALTER TABLE mutation_logs
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'success'
    `);
    await this.pool.query(`
      ALTER TABLE mutation_logs
      ADD COLUMN IF NOT EXISTS error_message TEXT NULL
    `);
    await this.pool.query(`
      ALTER TABLE mutation_logs
      ADD COLUMN IF NOT EXISTS permission_scope TEXT NULL
    `);
    await this.pool.query(`
      ALTER TABLE mutation_logs
      ADD COLUMN IF NOT EXISTS permission_org_count INTEGER NULL
    `);
    await this.pool.query(`
      ALTER TABLE mutation_logs
      ADD COLUMN IF NOT EXISTS permission_fallback_used BOOLEAN NULL
    `);
    await this.pool.query(`
      ALTER TABLE mutation_logs
      ADD COLUMN IF NOT EXISTS permission_reason TEXT NULL
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS migration_logs (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        version TEXT NOT NULL,
        migration_dsl JSONB NOT NULL,
        status TEXT NOT NULL,
        executed_sql TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        ip TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS bff_query_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        row_count INTEGER NULL,
        status TEXT NOT NULL,
        error_message TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS runtime_audit_events (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        node_id TEXT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bff_query_audit_logs_request_id
      ON bff_query_audit_logs (request_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bff_query_audit_logs_tenant_id
      ON bff_query_audit_logs (tenant_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_query_logs_request_id
      ON query_logs (request_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_runtime_audit_events_request_id
      ON runtime_audit_events (request_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_runtime_audit_events_plan_id
      ON runtime_audit_events (plan_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_runtime_audit_events_node_id
      ON runtime_audit_events (node_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_runtime_audit_events_event_type
      ON runtime_audit_events (event_type)
    `);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async persist(record: QueryAuditRecord): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO query_logs (
          request_id,
          tenant_id,
          user_id,
          table_name,
          query_dsl,
          final_sql,
          duration_ms,
          result_count,
          status,
          error_message,
          permission_scope,
          permission_org_count,
          permission_fallback_used,
          permission_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          record.requestId,
          record.tenantId,
          record.userId,
          record.tableName,
          record.queryDsl,
          record.finalSql,
          record.durationMs,
          record.resultCount,
          record.status,
          record.errorMessage,
          record.permissionScope,
          record.permissionOrgCount,
          record.permissionFallbackUsed,
          record.permissionReason
        ]
      );
      await this.pool.query(
        `INSERT INTO bff_query_audit_logs (
          request_id,
          tenant_id,
          user_id,
          table_name,
          duration_ms,
          row_count,
          status,
          error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          record.requestId,
          record.tenantId,
          record.userId,
          record.tableName ?? "__unknown_table__",
          record.durationMs,
          record.resultCount,
          record.status,
          record.errorMessage
        ]
      );
    } catch (error) {
      this.logger.warn(
        `persist audit failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async persistMutation(record: MutationAuditRecord): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO mutation_logs (
          request_id,
          tenant_id,
          user_id,
          table_name,
          operation,
          before_data,
          after_data,
          duration_ms,
          status,
          error_message,
          permission_scope,
          permission_org_count,
          permission_fallback_used,
          permission_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          record.requestId,
          record.tenantId,
          record.userId,
          record.tableName,
          record.operation,
          record.beforeData,
          record.afterData,
          record.durationMs,
          record.status,
          record.errorMessage,
          record.permissionScope,
          record.permissionOrgCount,
          record.permissionFallbackUsed,
          record.permissionReason
        ]
      );
    } catch (error) {
      this.logger.warn(
        `persist mutation audit failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async persistRuntimeEvent(event: RuntimeAuditEvent): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO runtime_audit_events (
          request_id,
          plan_id,
          node_id,
          event_type,
          status,
          payload
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          event.requestId,
          event.planId,
          event.nodeId ?? null,
          event.type,
          event.status,
          JSON.stringify(event)
        ]
      );
    } catch (error) {
      this.logger.warn(
        `persist runtime audit event failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
