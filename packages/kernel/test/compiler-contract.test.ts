import { test } from "node:test";
import assert from "node:assert/strict";
import { compileSchemaSql } from "../src";
import { ordersCompilerFixture } from "./fixtures/compiler-fixtures";

test("compiler fixture defines the public SQL generator contract", () => {
  const compiled = compileSchemaSql(ordersCompilerFixture.schema);

  assert.deepEqual(compiled, ordersCompilerFixture.expected);
});

test("compiler statements are grouped as tables then indexes then relations", () => {
  const compiled = compileSchemaSql(ordersCompilerFixture.schema);

  assert.deepEqual(compiled.statements, [
    ...compiled.tables,
    ...compiled.indexes,
    ...compiled.relations
  ]);
  assert.deepEqual(compiled.statements, ordersCompilerFixture.expected.statements);
});

test("compiler contract accepts table-only schemas without side effects", () => {
  const schema = {
    tables: [
      {
        name: "audit_logs",
        fields: [
          { name: "id", type: "uuid" },
          { name: "status", type: "string" }
        ]
      }
    ]
  };
  const before = JSON.stringify(schema);
  const compiled = compileSchemaSql(schema);

  assert.deepEqual(compiled, {
    tables: ['CREATE TABLE "audit_logs" ("id" UUID NOT NULL, "status" TEXT NOT NULL);'],
    indexes: [],
    relations: [],
    statements: ['CREATE TABLE "audit_logs" ("id" UUID NOT NULL, "status" TEXT NOT NULL);']
  });
  assert.equal(JSON.stringify(schema), before);
});
