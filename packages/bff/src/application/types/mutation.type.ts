import type {
  DataScopeDecision,
  MutationOperation
} from "../../contracts/types/bff-api.type";

export type OrderMutationPayload = {
  id: string;
  orgId: string | null;
  owner?: string;
  channel?: string;
  priority?: string;
  status?: string;
};

export type MutationExecutionResult = {
  rowCount: number;
  operation: MutationOperation;
  table: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  permissionDecision: DataScopeDecision;
};
