import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { canAccessOrg, resolveDataScope } from "@meta-lc/permission";
import type { DataScopeDecision } from "@meta-lc/contracts";
import { ForbiddenDataScopeError } from "../common/permission-errors";
import { OrgScopeService } from "../integration/org-scope.service";
import { PostgresQueryExecutorService } from "../integration/postgres-query-executor.service";
import type { MutationApiRequest, MutationOperation } from "../types";

interface OrderMutationPayload {
  id: string;
  orgId: string | null;
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
  permissionDecision: DataScopeDecision;
}

@Injectable()
export class MutationOrchestratorService {
  constructor(
    private readonly queryExecutor: PostgresQueryExecutorService,
    private readonly orgScopeService: OrgScopeService
  ) {}

  async execute(request: MutationApiRequest): Promise<MutationExecutionResult> {
    if (!request.tenantId || !request.userId) {
      throw new BadRequestException("tenantId and userId are required.");
    }
    if (request.table !== "orders") {
      throw new BadRequestException("only orders table is supported.");
    }

    const payload = normalizeMutationPayload(request);
    const orgScopeContext = await this.orgScopeService.resolveContext({
      tenantId: request.tenantId,
      userId: request.userId,
      roles: request.roles
    });
    const permissionDecision = resolveDataScope(orgScopeContext);

    if (request.operation === "create") {
      if (!payload.orgId) {
        throw new BadRequestException("orgId is required for create.");
      }
      const createAccess = canAccessOrg(
        permissionDecision,
        {
          orgId: payload.orgId,
          createdBy: request.userId
        },
        {
          tenantId: request.tenantId,
          userId: request.userId,
          roles: request.roles
        }
      );
      if (!createAccess.allowed) {
        throw new ForbiddenDataScopeError({
          decision: permissionDecision,
          reason: createAccess.reason
        });
      }
    }

    try {
      if (request.operation !== "create") {
        const existing = await this.queryExecutor.findOrderById({
          id: payload.id,
          tenantId: request.tenantId
        });
        if (!existing) {
          throw new NotFoundException(`order ${payload.id} not found`);
        }
        const access = canAccessOrg(
          permissionDecision,
          {
            orgId: (existing.org_id as string | null) ?? null,
            createdBy: (existing.created_by as string | null) ?? null
          },
          {
            tenantId: request.tenantId,
            userId: request.userId,
            roles: request.roles
          }
        );
        if (!access.allowed) {
          throw new ForbiddenDataScopeError({
            decision: permissionDecision,
            reason: access.reason
          });
        }

        if (request.operation === "update" && !payload.orgId) {
          payload.orgId = (existing.org_id as string | null) ?? null;
        }
      }

      const result = await this.queryExecutor.mutateOrder({
        operation: request.operation,
        tenantId: request.tenantId,
        userId: request.userId,
        superAdmin: request.roles.includes("SUPER_ADMIN"),
        orgId: payload.orgId,
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
        afterData: result.afterData,
        permissionDecision
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
    return { id, orgId: request.orgId ?? null };
  }

  const orgId = resolveOrgId(request);
  if (request.operation === "create" && !orgId) {
    throw new BadRequestException("orgId is required.");
  }

  const owner = String(source["owner"] ?? "").trim();
  if (!owner) {
    throw new BadRequestException("owner is required.");
  }

  return {
    id,
    orgId,
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

function resolveOrgId(request: MutationApiRequest): string | null {
  if (typeof request.orgId === "string" && request.orgId.trim()) {
    return request.orgId.trim();
  }
  const fromData = request.data?.["org_id"];
  if (typeof fromData === "string" && fromData.trim()) {
    return fromData.trim();
  }
  return null;
}

function isPgDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code?: unknown }).code) === "23505"
  );
}
