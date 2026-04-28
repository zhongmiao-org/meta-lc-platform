import type {
  AccessAuditLog,
  MigrationAuditLog,
  MutationAuditLog,
  QueryAuditLog,
  RuntimeAuditEvent
} from "../types";

export interface RuntimeAuditObserver {
  recordRuntimeEvent(event: RuntimeAuditEvent): void | Promise<void>;
}

export interface RuntimeAuditSink extends RuntimeAuditObserver {}

export interface AuditSink {
  logQuery(log: QueryAuditLog): Promise<void>;
  logMutation(log: MutationAuditLog): Promise<void>;
  logMigration(log: MigrationAuditLog): Promise<void>;
  logAccess(log: AccessAuditLog): Promise<void>;
  recordRuntimeEvent?(event: RuntimeAuditEvent): Promise<void>;
  close?(): Promise<void>;
}
