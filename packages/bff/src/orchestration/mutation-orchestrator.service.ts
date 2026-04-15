import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PostgresQueryExecutorService } from "../integration/postgres-query-executor.service";
import type { MutationApiRequest, MutationOperation } from "../types";

interface OrderMutationPayload {
  id: string;
  owner?: string;
  channel?: string;
  priority?: string;
  status?: string;
}

export interface MutationExecutionResult {
  rowCount: number;
  operation: MutationOperation;
  table: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}

@Injectable()
export class MutationOrchestratorService {
  constructor(private readonly queryExecutor: PostgresQueryExecutorService) {}

  async execute(request: MutationApiRequest): Promise<MutationExecutionResult> {
    if (!request.tenantId || !request.userId) {
      throw new BadRequestException("tenantId and userId are required.");
    }
    if (request.table !== "orders") {
      throw new BadRequestException("only orders table is supported.");
    }

    const payload = normalizeMutationPayload(request);

    try {
      const result = await this.queryExecutor.mutateOrder({
        operation: request.operation,
        tenantId: request.tenantId,
        userId: request.userId,
        superAdmin: request.roles.includes("SUPER_ADMIN"),
        payload
      });

      if (result.rowCount < 1) {
        throw new NotFoundException(`order ${payload.id} not found`);
      }

      return {
        rowCount: result.rowCount,
        operation: request.operation,
        table: request.table,
        beforeData: result.beforeData,
        afterData: result.afterData
      };
    } catch (error) {
      if (isPgDuplicateKey(error)) {
        throw new ConflictException(`order ${payload.id} already exists`);
      }
      throw error;
    }
  }
}

function normalizeMutationPayload(request: MutationApiRequest): OrderMutationPayload {
  const source = request.data ?? {};
  const id = resolveId(request).trim();
  if (!id) {
    throw new BadRequestException("mutation key.id is required.");
  }

  if (request.operation === "delete") {
    return { id };
  }

  const owner = String(source["owner"] ?? "").trim();
  if (!owner) {
    throw new BadRequestException("owner is required.");
  }

  return {
    id,
    owner,
    channel: String(source["channel"] ?? "web"),
    priority: String(source["priority"] ?? "medium"),
    status: String(source["status"] ?? "active")
  };
}

function resolveId(request: MutationApiRequest): string {
  const keyId = request.key?.["id"];
  if (typeof keyId === "string" || typeof keyId === "number") {
    return String(keyId);
  }
  const dataId = request.data?.["id"];
  if (typeof dataId === "string" || typeof dataId === "number") {
    return String(dataId);
  }
  return "";
}

function isPgDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code?: unknown }).code) === "23505"
  );
}
