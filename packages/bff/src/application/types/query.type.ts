import type { DataScopeDecision } from "../../contracts/types/bff-api.type";

export type QueryExecutionResult = {
  rows: Record<string, unknown>[];
  finalSql: string;
  permissionDecision: DataScopeDecision;
};
