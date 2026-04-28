import type {
  AccessAuditLog,
  MigrationAuditLog,
  MutationAuditLog,
  QueryAuditLog,
  RuntimeAuditEvent
} from "../../core/types";
import type { AuditDbConfig, AuditSink } from "../../core/interfaces";

function createNoopAuditSink(): AuditSink {
  return {
    async logQuery(): Promise<void> {},
    async logMutation(): Promise<void> {},
    async logMigration(): Promise<void> {},
    async logAccess(): Promise<void> {},
    async recordRuntimeEvent(): Promise<void> {},
    async close(): Promise<void> {}
  };
}

export class AuditService {
  private readonly sink: AuditSink;

  constructor(_config: AuditDbConfig = {}, sink?: AuditSink) {
    void _config;
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

  async recordRuntimeEvent(event: RuntimeAuditEvent): Promise<void> {
    try {
      await this.sink.recordRuntimeEvent?.(event);
    } catch {
      // Audit must never become a runtime dependency.
    }
  }

  async close(): Promise<void> {
    await this.sink.close?.();
  }
}
