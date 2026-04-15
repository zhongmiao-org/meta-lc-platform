import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLogService } from "../src/common/audit-log.service";

test("logQuerySuccess degrades when persistence throws", async () => {
  const service = new AuditLogService({
    persist: async () => {
      throw new Error("db unavailable");
    }
  } as never);

  await assert.doesNotReject(async () => {
    await service.logQuerySuccess({
      requestId: "req-1",
      tenantId: "tenant-a",
      userId: "user-a",
      table: "orders",
      queryDsl: '{"table":"orders"}',
      finalSql: 'SELECT * FROM "orders"',
      durationMs: 12,
      resultCount: 1
    });
  });
});

test("logQueryFailure degrades when persistence throws", async () => {
  const service = new AuditLogService({
    persist: async () => {
      throw new Error("db unavailable");
    }
  } as never);

  await assert.doesNotReject(async () => {
    await service.logQueryFailure({
      requestId: "req-2",
      tenantId: "tenant-a",
      userId: "user-a",
      table: "orders",
      queryDsl: '{"table":"orders"}',
      durationMs: 12,
      error: "bad request"
    });
  });
});
