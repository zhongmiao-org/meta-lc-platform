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

export interface AuditSink {
  logQuery(log: QueryAuditLog): Promise<void>;
  logMutation(log: MutationAuditLog): Promise<void>;
  logMigration(log: MigrationAuditLog): Promise<void>;
  logAccess(log: AccessAuditLog): Promise<void>;
  close?(): Promise<void>;
}
