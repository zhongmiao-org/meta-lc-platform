import assert from "node:assert/strict";
import test from "node:test";
import { PostgresRuntimeAuditSink } from "../src/postgres/postgres-runtime-audit.sink";
import type { RuntimeAuditEvent } from "../src";

const config = {
  host: "127.0.0.1",
  port: 5432,
  user: "lowcode",
  password: "lowcode",
  database: "audit_db",
  ssl: false
};

test("PostgresRuntimeAuditSink persists runtime events as JSONB payload", async () => {
  const pool = new FakePool();
  const sink = new PostgresRuntimeAuditSink(config, pool as never);
  const event: RuntimeAuditEvent = {
    type: "runtime.datasource.succeeded",
    requestId: "req-1",
    planId: "plan-1",
    nodeId: "orders",
    nodeType: "query",
    timestamp: "2026-04-25T00:00:00.000Z",
    tenantId: "tenant-a",
    userId: "user-a",
    durationMs: 3,
    status: "success"
  };

  await sink.recordRuntimeEvent(event);

  const insert = pool.calls.find((call) => call.sql.includes("INSERT INTO runtime_audit_events"));
  assert.ok(insert);
  assert.deepEqual(insert.params, [
    "req-1",
    "plan-1",
    "orders",
    "runtime.datasource.succeeded",
    "success",
    JSON.stringify(event)
  ]);
  assert.equal(pool.calls.filter((call) => call.sql.includes("CREATE INDEX")).length, 4);
});

test("PostgresRuntimeAuditSink degrades to no-op when persistence fails", async () => {
  const pool = new FakePool(new Error("audit db offline"));
  const sink = new PostgresRuntimeAuditSink(config, pool as never);

  await assert.doesNotReject(() =>
    sink.recordRuntimeEvent({
      type: "runtime.node.failed",
      requestId: "req-2",
      planId: "plan-2",
      nodeId: "orders",
      nodeType: "query",
      timestamp: "2026-04-25T00:00:00.000Z",
      status: "failure",
      errorMessage: "boom"
    })
  );
});

interface QueryCall {
  sql: string;
  params?: unknown[];
}

class FakePool {
  readonly calls: QueryCall[] = [];

  constructor(private readonly failure?: Error) {}

  async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> {
    this.calls.push({ sql, params });
    if (this.failure) {
      throw this.failure;
    }
    return { rows: [], rowCount: 0 };
  }

  async end(): Promise<void> {}
}
