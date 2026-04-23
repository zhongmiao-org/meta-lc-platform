import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSchemas, generateMigrationSql } from "../src/domain/schema-diff";

test("diffSchemas returns table and field level changes", () => {
  const from = {
    tables: [
      {
        name: "orders",
        fields: [
          { name: "id", type: "uuid" },
          { name: "status", type: "string" }
        ]
      }
    ]
  };
  const to = {
    tables: [
      {
        name: "orders",
        fields: [
          { name: "id", type: "uuid" },
          { name: "status", type: "number" },
          { name: "tenant_id", type: "uuid" }
        ]
      },
      {
        name: "audit_logs",
        fields: [{ name: "id", type: "uuid" }]
      }
    ]
  };

  const diff = diffSchemas(from, to);
  assert.equal(diff.addedTables.length, 1);
  assert.equal(diff.addedTables[0].name, "audit_logs");
  assert.equal(diff.changedTables.length, 1);
  assert.equal(diff.changedTables[0].changedFields[0].field, "status");
  assert.equal(diff.changedTables[0].addedFields[0].name, "tenant_id");
});

test("generateMigrationSql emits create/alter statements", () => {
  const diff = diffSchemas(
    {
      tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }] }]
    },
    {
      tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }, { name: "status", type: "string" }] }]
    }
  );

  const sql = generateMigrationSql(diff);
  assert.deepEqual(sql, ['ALTER TABLE "orders" ADD COLUMN "status" TEXT NOT NULL;']);
});
