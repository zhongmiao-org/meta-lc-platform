import type { QueryAuditLog } from "@zhongmiao/meta-lc-contracts";

export interface MutationAuditLog {
  requestId: string;
  tenantId: string;
  userId: string;
  table: string;
  action: "create" | "update" | "delete";
  payload: string;
  status: "success" | "failure";
  errorMessage?: string | null;
}

export interface MigrationAuditLog {
  requestId: string;
  appId: string;
  fromVersion: number;
  toVersion: number;
  statement: string;
  status: "success" | "failure" | "blocked";
  durationMs: number;
  errorMessage?: string | null;
}

export interface AccessAuditLog {
  requestId: string;
  tenantId: string;
  userId: string;
  resource: string;
  action: string;
  status: "allow" | "deny";
  reason?: string;
}

export interface AuditDbConfig {
  connectionString?: string;
}

export interface AuditSink {
  logQuery(log: QueryAuditLog): Promise<void>;
  logMutation(log: MutationAuditLog): Promise<void>;
  logMigration(log: MigrationAuditLog): Promise<void>;
  logAccess(log: AccessAuditLog): Promise<void>;
  close?(): Promise<void>;
}

function createNoopAuditSink(): AuditSink {
  return {
    async logQuery(): Promise<void> {},
    async logMutation(): Promise<void> {},
    async logMigration(): Promise<void> {},
    async logAccess(): Promise<void> {},
    async close(): Promise<void> {}
  };
}

export class AuditService {
  private readonly sink: AuditSink;

  constructor(_config: AuditDbConfig = {}, sink?: AuditSink) {
    this.sink = sink ?? createNoopAuditSink();
  }

  async logQuery(log: QueryAuditLog): Promise<void> {
    await this.sink.logQuery(log);
  }

  async logMutation(log: MutationAuditLog): Promise<void> {
    await this.sink.logMutation(log);
  }

  async logMigration(log: MigrationAuditLog): Promise<void> {
    await this.sink.logMigration(log);
  }

  async logAccess(log: AccessAuditLog): Promise<void> {
    await this.sink.logAccess(log);
  }

  async close(): Promise<void> {
    await this.sink.close?.();
  }
}
