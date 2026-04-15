export interface QueryApiRequest {
  table: string;
  fields: string[];
  filters?: Record<string, string | number | boolean>;
  tenantId: string;
  userId: string;
  roles: string[];
  limit?: number;
}

export interface DbConfig {
  url?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface DbTargets {
  meta: DbConfig;
  business: DbConfig;
  audit: DbConfig;
}

export type BootstrapMode = "auto" | "manual";

export type AuditStatus = "success" | "failure" | "blocked";

export interface QueryAuditLog {
  requestId: string;
  tenantId: string;
  userId: string;
  queryDsl: string;
  finalSql: string;
  durationMs: number;
  resultCount: number;
  status: AuditStatus;
  errorMessage?: string | null;
}
