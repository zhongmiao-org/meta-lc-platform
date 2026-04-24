export type QueryAuditRecord = {
  requestId: string;
  tenantId: string;
  userId: string;
  tableName: string | null;
  queryDsl: string | null;
  finalSql: string | null;
  durationMs: number;
  resultCount: number | null;
  status: "success" | "failure" | "denied";
  errorMessage: string | null;
  permissionScope: string | null;
  permissionOrgCount: number | null;
  permissionFallbackUsed: boolean | null;
  permissionReason: string | null;
};

export type MutationAuditRecord = {
  requestId: string;
  tenantId: string;
  userId: string;
  tableName: string;
  operation: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  durationMs: number;
  status: "success" | "failure" | "denied";
  errorMessage: string | null;
  permissionScope: string | null;
  permissionOrgCount: number | null;
  permissionFallbackUsed: boolean | null;
  permissionReason: string | null;
};
