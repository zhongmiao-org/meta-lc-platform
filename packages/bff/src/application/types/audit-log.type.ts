export type QueryAuditPayload = {
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
};

export type MutationAuditPayload = {
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
};
