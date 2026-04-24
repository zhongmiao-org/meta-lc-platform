import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DatasourceAdapterError,
  type DatasourceAdapter,
  type DatasourceExecutionRequest,
  PostgresDatasourceAdapter
} from "../src";

const dbConfig = {
  host: "127.0.0.1",
  port: 5432,
  user: "lowcode",
  password: "lowcode",
  database: "business_db",
  ssl: false
};

test("PostgresDatasourceAdapter executes select requests and normalizes results", async () => {
  const calls: DatasourceExecutionRequest[] = [];
  const adapter = new PostgresDatasourceAdapter(dbConfig, {
    async query(sql, params = []) {
      calls.push({ kind: "query", sql, params });
      return {
        rows: [{ id: "order-1" }],
        rowCount: 1
      };
    },
    async end() {}
  });

  const result = await adapter.execute({
    kind: "query",
    sql: 'SELECT "id" FROM "orders" WHERE "tenant_id" = $1',
    params: ["tenant-a"]
  });

  assert.deepEqual(calls, [
    {
      kind: "query",
      sql: 'SELECT "id" FROM "orders" WHERE "tenant_id" = $1',
      params: ["tenant-a"]
    }
  ]);
  assert.deepEqual(result.rows, [{ id: "order-1" }]);
  assert.equal(result.rowCount, 1);
  assert.equal(result.metadata.kind, "query");
  assert.equal(typeof result.metadata.durationMs, "number");
});

test("PostgresDatasourceAdapter executes mutation requests and preserves row count", async () => {
  const adapter = new PostgresDatasourceAdapter(dbConfig, {
    async query() {
      return {
        rows: [],
        rowCount: 2
      };
    },
    async end() {}
  });

  const result = await adapter.execute({
    kind: "mutation",
    sql: 'UPDATE "orders" SET "status" = $1 WHERE "tenant_id" = $2',
    params: ["active", "tenant-a"]
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.rowCount, 2);
  assert.equal(result.metadata.kind, "mutation");
});

test("PostgresDatasourceAdapter query helper delegates to execute and returns rows", async () => {
  const adapter = new PostgresDatasourceAdapter(dbConfig, {
    async query() {
      return {
        rows: [{ ok: true }],
        rowCount: 1
      };
    },
    async end() {}
  });

  assert.deepEqual(await adapter.query("SELECT 1 AS ok"), [{ ok: true }]);
});

test("PostgresDatasourceAdapter wraps query errors", async () => {
  const cause = new Error("database offline");
  const adapter = new PostgresDatasourceAdapter(dbConfig, {
    async query() {
      throw cause;
    },
    async end() {}
  });

  await assert.rejects(
    () => adapter.execute({ kind: "query", sql: "SELECT 1" }),
    (error: unknown) => {
      assert.ok(error instanceof DatasourceAdapterError);
      assert.equal(error.kind, "query");
      assert.equal(error.cause, cause);
      assert.match(error.message, /database offline/);
      return true;
    }
  );
});

test("DatasourceAdapter contract accepts a conforming adapter", async () => {
  const adapter: DatasourceAdapter = {
    async execute(request) {
      return {
        rows: [{ sql: request.sql }],
        rowCount: 1,
        metadata: {
          kind: request.kind,
          durationMs: 0
        }
      };
    }
  };

  const result = await adapter.execute({ kind: "query", sql: "SELECT 1" });
  assert.deepEqual(result.rows, [{ sql: "SELECT 1" }]);
});
