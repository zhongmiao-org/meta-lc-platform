import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMigrationDslFromSnapshots,
  computeSnapshotChecksum,
  type SnapshotV1
} from "@meta-lc/kernel";
import { apply, compileToSql } from "../src";

function snapshot(version: string, withStatus: boolean): SnapshotV1 {
  const payload = {
    version,
    tables: [
      {
        name: "orders",
        fields: [
          { name: "id", type: "uuid" },
          ...(withStatus ? [{ name: "status", type: "string" }] : [])
        ]
      }
    ],
    relations: [],
    permissions: []
  };
  return {
    ...payload,
    checksum: computeSnapshotChecksum(payload)
  };
}

test("migration compile and apply", async () => {
  const dsl = buildMigrationDslFromSnapshots(snapshot("v1", false), snapshot("v2", true));
  const compiled = compileToSql(dsl);
  assert.equal(compiled.up.length > 0, true);

  const executed: string[] = [];
  const result = await apply("business", compiled.up, async (statement) => {
    executed.push(statement);
  });

  assert.equal(result.appliedCount, compiled.up.length);
  assert.deepEqual(executed, compiled.up);
});
