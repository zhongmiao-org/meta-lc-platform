import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  MutationAdapterCommand,
  MutationAdapterResult,
  RuntimeViewExecutorDependencies
} from "@zhongmiao/meta-lc-runtime";
import { PostgresQueryExecutorService } from "./postgres-query.service";

@Injectable()
export class RuntimeViewDependenciesService {
  constructor(private readonly queryExecutor: PostgresQueryExecutorService) {}

  create(): RuntimeViewExecutorDependencies {
    const queryExecutor = this.queryExecutor;
    return {
      queryDatasource: {
        async query(sql, params = []) {
          return queryExecutor.query(sql, params);
        }
      },
      mutationDatasource: {
        async execute(command) {
          return executeOrdersMutation(command, queryExecutor);
        }
      }
    };
  }
}

async function executeOrdersMutation(
  command: MutationAdapterCommand,
  queryExecutor: PostgresQueryExecutorService
): Promise<MutationAdapterResult> {
  if (command.model !== "orders") {
    throw new BadRequestException(`unsupported mutation model "${command.model}"`);
  }

  const payload = command.payload;
  const id = readRequiredString(payload.id, "payload.id");
  const orgId = readNullableString(payload.orgId ?? null, "payload.orgId");
  const owner = readOptionalString(payload.owner, "payload.owner");
  const channel = readOptionalString(payload.channel, "payload.channel");
  const priority = readOptionalString(payload.priority, "payload.priority");
  const status = readOptionalString(payload.status, "payload.status");

  if (command.operation !== "delete" && !owner) {
    throw new BadRequestException("payload.owner is required for orders mutation.");
  }

  const result = await queryExecutor.mutateOrder({
    operation: command.operation,
    tenantId: String(command.context.tenantId ?? ""),
    userId: String(command.context.userId ?? ""),
    superAdmin: Array.isArray(command.context.roles)
      ? command.context.roles.includes("SUPER_ADMIN")
      : false,
    orgId,
    payload: {
      id,
      orgId,
      ...(owner ? { owner } : {}),
      ...(channel ? { channel } : {}),
      ...(priority ? { priority } : {}),
      ...(status ? { status } : {})
    }
  });

  return {
    rowCount: result.rowCount,
    row: result.afterData ?? result.beforeData,
    beforeData: result.beforeData,
    afterData: result.afterData
  };
}

function readRequiredString(value: unknown, key: string): string {
  const result = readOptionalString(value, key);
  if (!result) {
    throw new BadRequestException(`${key} is required.`);
  }
  return result;
}

function readOptionalString(value: unknown, key: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`${key} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readNullableString(value: unknown, key: string): string | null {
  const result = readOptionalString(value, key);
  return result ?? null;
}
