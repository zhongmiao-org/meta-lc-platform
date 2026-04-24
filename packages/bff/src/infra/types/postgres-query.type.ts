import type { MutationOperation } from "../../contracts/types/bff-api.type";

export type OrderMutationPayload = {
  id: string;
  orgId: string | null;
  owner?: string;
  channel?: string;
  priority?: string;
  status?: string;
};

export type OrderMutationCommand = {
  operation: MutationOperation;
  tenantId: string;
  userId: string;
  superAdmin: boolean;
  orgId: string | null;
  payload: OrderMutationPayload;
};

export type MutationExecutionRecord = {
  rowCount: number;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
};
