import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import { loadDbTargets } from "../config";

export interface QueryAuditRecord {
  requestId: string;
  tenantId: string;
  userId: string;
  tableName: string | null;
  queryDsl: string | null;
  finalSql: string | null;
  durationMs: number;
  resultCount: number | null;
  status: "success" | "failure";
  errorMessage: string | null;
}

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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
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
          error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
          record.errorMessage
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
}
