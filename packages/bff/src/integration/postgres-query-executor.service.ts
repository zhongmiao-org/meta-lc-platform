import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient } from "pg";
import { loadDbConfig } from "../config";
import type { MutationOperation } from "../types";

interface OrderMutationPayload {
  id: string;
  owner?: string;
  channel?: string;
  priority?: string;
  status?: string;
}

export interface OrderMutationCommand {
  operation: MutationOperation;
  tenantId: string;
  userId: string;
  superAdmin: boolean;
  payload: OrderMutationPayload;
}

export interface MutationExecutionRecord {
  rowCount: number;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}

@Injectable()
export class PostgresQueryExecutorService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const config = loadDbConfig();
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  async query(sql: string, params: Array<string | number | boolean>): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async health(): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }

  async mutateOrder(command: OrderMutationCommand): Promise<MutationExecutionRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      if (command.operation === "create") {
        const created = await client.query<Record<string, unknown>>(
          `INSERT INTO orders (id, owner, channel, priority, status, tenant_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, owner, channel, priority, status, tenant_id, created_by`,
          [
            command.payload.id,
            command.payload.owner ?? "",
            command.payload.channel ?? "web",
            command.payload.priority ?? "medium",
            command.payload.status ?? "active",
            command.tenantId,
            command.userId
          ]
        );
        await client.query("COMMIT");
        return {
          rowCount: created.rowCount ?? 0,
          beforeData: null,
          afterData: created.rows[0] ?? null
        };
      }

      const before = await this.selectCurrentOrder(client, command);
      if (!before) {
        await client.query("ROLLBACK");
        return {
          rowCount: 0,
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
               status = $4
           WHERE ${buildUpdateWhereClause(command.superAdmin)}
           RETURNING id, owner, channel, priority, status, tenant_id, created_by`,
          [
            command.payload.owner ?? "",
            command.payload.channel ?? "web",
            command.payload.priority ?? "medium",
            command.payload.status ?? "active",
            command.payload.id,
            ...buildScopeParams(command)
          ]
        );
        await client.query("COMMIT");
        return {
          rowCount: updated.rowCount ?? 0,
          beforeData: before,
          afterData: updated.rows[0] ?? null
        };
      }

      const deleted = await client.query(
        `DELETE FROM orders
         WHERE id = $1${buildScopedWhereClause(command.superAdmin)}`,
        [command.payload.id, ...buildScopeParams(command)]
      );
      await client.query("COMMIT");
      return {
        rowCount: deleted.rowCount ?? 0,
        beforeData: before,
        afterData: null
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async selectCurrentOrder(
    client: PoolClient,
    command: OrderMutationCommand
  ): Promise<Record<string, unknown> | null> {
    const result = await client.query<Record<string, unknown>>(
      `SELECT id, owner, channel, priority, status, tenant_id, created_by
       FROM orders
       WHERE id = $1${buildScopedWhereClause(command.superAdmin)}`,
      [command.payload.id, ...buildScopeParams(command)]
    );
    return result.rows[0] ?? null;
  }
}

function buildScopedWhereClause(superAdmin: boolean): string {
  return superAdmin ? "" : " AND tenant_id = $2 AND created_by = $3";
}

function buildUpdateWhereClause(superAdmin: boolean): string {
  return superAdmin ? "id = $5" : "id = $5 AND tenant_id = $6 AND created_by = $7";
}

function buildScopeParams(command: OrderMutationCommand): string[] {
  return command.superAdmin ? [] : [command.tenantId, command.userId];
}
