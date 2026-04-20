import { test } from "node:test";
import assert from "node:assert/strict";
import { compileSchemaSql } from "../src";
import { ordersCompilerFixture } from "./fixtures/compiler-fixtures";

test("compileSchemaSql emits stable table, index, and relation statements", () => {
  const compiled = compileSchemaSql(ordersCompilerFixture.schema);

  assert.deepEqual(compiled.tables, ordersCompilerFixture.expected.sql.tables);
  assert.deepEqual(compiled.indexes, ordersCompilerFixture.expected.sql.indexes);
  assert.deepEqual(compiled.relations, ordersCompilerFixture.expected.sql.relations);
  assert.deepEqual(compiled.statements, ordersCompilerFixture.expected.sql.statements);
});

test("compileSchemaSql rejects invalid identifiers before emitting SQL", () => {
  assert.throws(
    () =>
      compileSchemaSql({
        tables: [
          {
            name: "orders;drop",
            fields: [{ name: "id", type: "uuid" }]
          }
        ]
      }),
    /Invalid identifier: orders;drop/
  );
});
