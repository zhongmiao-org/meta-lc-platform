import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  PostgresDatasourceAdapter,
  type DatasourceExecutionRequest,
  type DatasourceExecutionResult,
  type DatasourceParamValue
} from "@zhongmiao/meta-lc-datasource";
import { Pool, type PoolClient } from "pg";
import { loadDbConfig } from "../../config/config";
import type {
  MutationExecutionRecord,
  OrderMutationCommand
} from "../types/postgres-query.type";

@Injectable()
export class PostgresQueryExecutorService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly datasource: PostgresDatasourceAdapter;

  constructor() {
    const config = loadDbConfig();
    this.datasource = new PostgresDatasourceAdapter(config);
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  async execute(request: DatasourceExecutionRequest): Promise<DatasourceExecutionResult> {
    return this.datasource.execute(request);
  }

  async query(sql: string, params: DatasourceParamValue[]): Promise<Record<string, unknown>[]> {
    return this.datasource.query(sql, params);
  }

  async health(): Promise<boolean> {
    return this.datasource.healthCheck();
  }

  async mutateOrder(command: OrderMutationCommand): Promise<MutationExecutionRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

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
        await client.query("COMMIT");
        return {
          rowCount: updated.rowCount ?? 0,
          beforeData: before,
          afterData: updated.rows[0] ?? null
        };
      }

      const deleted = await client.query(
        `DELETE FROM orders
         WHERE id = $1 AND tenant_id = $2`,
        [command.payload.id, command.tenantId]
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
    await Promise.all([this.pool.end(), this.datasource.close()]);
  }

  private async selectCurrentOrder(
    client: PoolClient,
    command: OrderMutationCommand
  ): Promise<Record<string, unknown> | null> {
    const result = await client.query<Record<string, unknown>>(
      `SELECT id, owner, channel, priority, status, tenant_id, created_by, org_id
       FROM orders
       WHERE id = $1 AND tenant_id = $2`,
      [command.payload.id, command.tenantId]
    );
    return result.rows[0] ?? null;
  }

  async findOrderById(input: { id: string; tenantId: string }): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, owner, channel, priority, status, tenant_id, created_by, org_id
       FROM orders
       WHERE id = $1 AND tenant_id = $2`,
      [input.id, input.tenantId]
    );
    return result.rows[0] ?? null;
  }
}
