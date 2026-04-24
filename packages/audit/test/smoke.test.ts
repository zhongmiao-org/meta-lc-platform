import test from "node:test";
import assert from "node:assert/strict";
import { AuditService, type RuntimeAuditEvent } from "../src";

test("audit service class exists", () => {
  assert.equal(typeof AuditService, "function");
});

test("AuditService records runtime observability events through the sink", async () => {
  const events: RuntimeAuditEvent[] = [];
  const service = new AuditService({}, {
    async logQuery() {},
    async logMutation() {},
    async logMigration() {},
    async logAccess() {},
    async recordRuntimeEvent(event) {
      events.push(event);
    }
  });

  await service.recordRuntimeEvent({
    type: "runtime.plan.started",
    requestId: "req-1",
    planId: "req-1",
    timestamp: "2026-04-24T00:00:00.000Z",
    status: "started",
    viewName: "orders-workbench"
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "runtime.plan.started");
});

test("AuditService degrades when runtime event sink throws", async () => {
  const service = new AuditService({}, {
    async logQuery() {},
    async logMutation() {},
    async logMigration() {},
    async logAccess() {},
    async recordRuntimeEvent() {
      throw new Error("audit db unavailable");
    }
  });

  await assert.doesNotReject(() =>
    service.recordRuntimeEvent({
      type: "runtime.node.failed",
      requestId: "req-2",
      planId: "req-2",
      timestamp: "2026-04-24T00:00:00.000Z",
      nodeId: "orders",
      nodeType: "query",
      status: "failure",
      errorMessage: "boom"
    })
  );
});

test("AuditService keeps legacy query and mutation APIs available", async () => {
  const calls: string[] = [];
  const service = new AuditService({}, {
    async logQuery() {
      calls.push("query");
    },
    async logMutation() {
      calls.push("mutation");
    },
    async logMigration() {},
    async logAccess() {}
  });

  await service.logQuery({
    requestId: "req-3",
    tenantId: "tenant-a",
    userId: "user-a",
    queryDsl: "{}",
    finalSql: "select 1",
    durationMs: 1,
    resultCount: 1,
    status: "success"
  });
  await service.logMutation({
    requestId: "req-4",
    tenantId: "tenant-a",
    userId: "user-a",
    table: "orders",
    action: "create",
    payload: "{}",
    status: "success"
  });

  assert.deepEqual(calls, ["query", "mutation"]);
});
