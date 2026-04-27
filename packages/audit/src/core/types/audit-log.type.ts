export type AuditStatus = "success" | "failure" | "blocked";

export type QueryAuditLog = {
  requestId: string;
  tenantId: string;
  userId: string;
  queryDsl: string;
  finalSql: string;
  durationMs: number;
  resultCount: number;
  status: AuditStatus;
  errorMessage?: string | null;
};

export type MutationAuditLog = {
  requestId: string;
  tenantId: string;
  userId: string;
  table: string;
  action: "create" | "update" | "delete";
  payload: string;
  status: "success" | "failure";
  errorMessage?: string | null;
};

export type MigrationAuditLog = {
  requestId: string;
  appId: string;
  fromVersion: number;
  toVersion: number;
  statement: string;
  status: "success" | "failure" | "blocked";
  durationMs: number;
  errorMessage?: string | null;
};

export type AccessAuditLog = {
  requestId: string;
  tenantId: string;
  userId: string;
  resource: string;
  action: string;
  status: "allow" | "deny";
  reason?: string;
};
