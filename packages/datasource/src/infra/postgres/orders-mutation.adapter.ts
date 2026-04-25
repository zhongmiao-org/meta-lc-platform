import { Pool, type PoolClient } from "pg";
import type { DbConfig } from "../../types/shared.types";

export type PostgresOrdersMutationOperation = "create" | "update" | "delete";

export interface PostgresOrdersMutationCommand {
  model: string;
  operation: PostgresOrdersMutationOperation;
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
}

export interface PostgresOrdersMutationResult {
  rowCount: number;
  row: Record<string, unknown> | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}

export class PostgresOrdersMutationAdapter {
  private readonly pool: Pool;

  constructor(config: DbConfig, pool?: Pool) {
    this.pool = pool ?? createPool(config);
  }

  async execute(command: PostgresOrdersMutationCommand): Promise<PostgresOrdersMutationResult> {
    if (command.model !== "orders") {
      throw new Error(`unsupported mutation model "${command.model}"`);
    }

    const tenantId = readRequiredString(command.context.tenantId, "context.tenantId");
    const userId = readRequiredString(command.context.userId, "context.userId");
    const id = readRequiredString(command.payload.id, "payload.id");
    const orgId = readNullableString(command.payload.orgId, "payload.orgId");
    const owner = readOptionalString(command.payload.owner, "payload.owner");
    const channel = readOptionalString(command.payload.channel, "payload.channel");
    const priority = readOptionalString(command.payload.priority, "payload.priority");
    const status = readOptionalString(command.payload.status, "payload.status");

    if (command.operation !== "delete" && !owner) {
      throw new Error("payload.owner is required for orders mutation.");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await executeOrderMutation(client, {
        operation: command.operation,
        tenantId,
        userId,
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
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

async function executeOrderMutation(
  client: PoolClient,
  command: {
    operation: PostgresOrdersMutationOperation;
    tenantId: string;
    userId: string;
    orgId: string | null;
    payload: {
      id: string;
      orgId: string | null;
      owner?: string;
      channel?: string;
      priority?: string;
      status?: string;
    };
  }
): Promise<PostgresOrdersMutationResult> {
  if (command.operation === "create") {
    const created = await client.query<Record<string, unknown>>(
      `INSERT INTO orders (id, owner, channel, priority, status, tenant_id, created_by, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, owner, channel, priority, status, tenant_id, created_by, org_id`,
      [
        command.payload.id,
        command.payload.owner ?? "",
        command.payload.channel ?? "web",
        command.payload.priority ?? "medium",
        command.payload.status ?? "active",
        command.tenantId,
        command.userId,
        command.orgId
      ]
    );
    const afterData = created.rows[0] ?? null;
    return {
      rowCount: created.rowCount ?? 0,
      row: afterData,
      beforeData: null,
      afterData
    };
  }

  const beforeData = await selectCurrentOrder(client, command.payload.id, command.tenantId);
  if (!beforeData) {
    return {
      rowCount: 0,
      row: null,
      beforeData: null,
      afterData: null
    };
  }

  if (command.operation === "update") {
    const updated = await client.query<Record<string, unknown>>(
      `UPDATE orders
       SET owner = $1,
           channel = $2,
           priority = $3,
           status = $4,
           org_id = $5
       WHERE id = $6 AND tenant_id = $7
       RETURNING id, owner, channel, priority, status, tenant_id, created_by, org_id`,
      [
        command.payload.owner ?? "",
        command.payload.channel ?? "web",
        command.payload.priority ?? "medium",
        command.payload.status ?? "active",
        command.orgId,
        command.payload.id,
        command.tenantId
      ]
    );
    const afterData = updated.rows[0] ?? null;
    return {
      rowCount: updated.rowCount ?? 0,
      row: afterData,
      beforeData,
      afterData
    };
  }

  const deleted = await client.query(
    `DELETE FROM orders
     WHERE id = $1 AND tenant_id = $2`,
    [command.payload.id, command.tenantId]
  );
  return {
    rowCount: deleted.rowCount ?? 0,
    row: beforeData,
    beforeData,
    afterData: null
  };
}

async function selectCurrentOrder(
  client: PoolClient,
  id: string,
  tenantId: string
): Promise<Record<string, unknown> | null> {
  const result = await client.query<Record<string, unknown>>(
    `SELECT id, owner, channel, priority, status, tenant_id, created_by, org_id
     FROM orders
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  return result.rows[0] ?? null;
}

function readRequiredString(value: unknown, key: string): string {
  const result = readOptionalString(value, key);
  if (!result) {
    throw new Error(`${key} is required.`);
  }
  return result;
}

function readOptionalString(value: unknown, key: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readNullableString(value: unknown, key: string): string | null {
  return readOptionalString(value, key) ?? null;
}

function createPool(config: DbConfig): Pool {
  if (config.url) {
    return new Pool({
      connectionString: config.url,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  return new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });
}
