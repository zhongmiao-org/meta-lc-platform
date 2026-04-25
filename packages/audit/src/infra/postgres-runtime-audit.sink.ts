import { Pool } from "pg";
import type {
  RuntimeAuditEvent,
  RuntimeAuditObserver
} from "../domain/audit.entity";

export interface PostgresRuntimeAuditConfig {
  url?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export class PostgresRuntimeAuditSink implements RuntimeAuditObserver {
  private readonly pool: Pool;
  private initialized = false;

  constructor(config: PostgresRuntimeAuditConfig, pool?: Pool) {
    this.pool = pool ?? createPool(config);
  }

  async recordRuntimeEvent(event: RuntimeAuditEvent): Promise<void> {
    try {
      await this.init();
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
    } catch {
      // Audit is observability only and must never block runtime execution.
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
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
    this.initialized = true;
  }
}

function createPool(config: PostgresRuntimeAuditConfig): Pool {
  if (config.url) {
    return new Pool({
      connectionString: config.url,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  return new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });
}
