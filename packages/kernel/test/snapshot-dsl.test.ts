import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMigrationDslFromSnapshots,
  compileMigrationDslToSql,
  computeMigrationDslChecksum,
  computeSnapshotChecksum,
  validateMigrationDslV1,
  validateSnapshotV1
} from "../src/domain/snapshot-dsl";
import { assertMigrationSafety } from "../src/domain/migration-safety";
import type { MigrationDslV1, SnapshotV1 } from "../src/core/types";

function createSnapshot(version: string, tables: SnapshotV1["tables"]): SnapshotV1 {
  const payload = {
    version,
    tables,
    relations: [],
    permissions: []
  };
  return {
    ...payload,
    checksum: computeSnapshotChecksum(payload)
  };
}

test("validateSnapshotV1 rejects checksum mismatch", () => {
  const snapshot = createSnapshot("v1.0.0", [
    { name: "orders", fields: [{ name: "id", type: "uuid" }] }
  ]);
  const invalid = { ...snapshot, checksum: "invalid" };
  assert.throws(() => validateSnapshotV1(invalid), /checksum mismatch/);
});

test("buildMigrationDslFromSnapshots is deterministic and checksum verified", () => {
  const from = createSnapshot("v1.0.0", [
    { name: "orders", fields: [{ name: "id", type: "uuid" }] }
  ]);
  const to = createSnapshot("v1.1.0", [
    {
      name: "orders",
      fields: [
        { name: "id", type: "uuid" },
        { name: "amount", type: "number" }
      ]
    }
  ]);

  const dslA = buildMigrationDslFromSnapshots(from, to);
  const dslB = buildMigrationDslFromSnapshots(from, to);

  assert.deepEqual(dslA, dslB);
  assert.doesNotThrow(() => validateMigrationDslV1(dslA));
});

test("compileMigrationDslToSql emits reversible up/down sql", () => {
  const dslPayload = {
    version: "v1.1.0",
    actions: [
      {
        type: "add_column",
        table: "orders",
        column: { name: "amount", type: "number", nullable: false }
      }
    ]
  } as const satisfies Omit<MigrationDslV1, "checksum">;

  const dsl: MigrationDslV1 = {
    ...dslPayload,
    checksum: computeMigrationDslChecksum(dslPayload)
  };

  const compiled = compileMigrationDslToSql(dsl);
  assert.deepEqual(compiled.up, ['ALTER TABLE "orders" ADD COLUMN "amount" INTEGER NOT NULL;']);
  assert.deepEqual(compiled.down, ['ALTER TABLE "orders" DROP COLUMN "amount";']);
});

test("destructive statements remain blocked by default safety guard", () => {
  const dslPayload = {
    version: "v2.0.0",
    actions: [
      {
        type: "drop_table",
        table: {
          name: "orders",
          fields: [{ name: "id", type: "uuid" }]
        }
      }
    ]
  } as const satisfies Omit<MigrationDslV1, "checksum">;

  const dsl: MigrationDslV1 = {
    ...dslPayload,
    checksum: computeMigrationDslChecksum(dslPayload)
  };
  const compiled = compileMigrationDslToSql(dsl);

  assert.throws(() => assertMigrationSafety(compiled.up), /Blocked destructive migration statements/);
  assert.doesNotThrow(() => assertMigrationSafety(compiled.up, { allowDestructive: true }));
});
