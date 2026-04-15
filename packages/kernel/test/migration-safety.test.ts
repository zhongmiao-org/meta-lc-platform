import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertMigrationSafety,
  createMigrationSafetyReport
} from "../src/migration-safety";

test("createMigrationSafetyReport detects destructive statements", () => {
  const report = createMigrationSafetyReport([
    'ALTER TABLE "orders" ADD COLUMN "status" TEXT NOT NULL;',
    'ALTER TABLE "orders" DROP COLUMN "status";'
  ]);

  assert.equal(report.destructiveStatements.length, 1);
  assert.equal(report.blockedStatements.length, 1);
});

test("assertMigrationSafety blocks destructive statements by default", () => {
  assert.throws(
    () =>
      assertMigrationSafety(['ALTER TABLE "orders" DROP COLUMN "status";']),
    /Blocked destructive migration statements/
  );
});

test("assertMigrationSafety allows destructive statements when explicitly enabled", () => {
  const report = assertMigrationSafety(
    ['ALTER TABLE "orders" DROP COLUMN "status";'],
    { allowDestructive: true }
  );

  assert.equal(report.destructiveStatements.length, 1);
  assert.equal(report.blockedStatements.length, 0);
});
