import { test } from "node:test";
import assert from "node:assert/strict";
import { compileSelectQuery } from "../src/query-compiler";

test("compileSelectQuery builds parameterized SQL", () => {
  const compiled = compileSelectQuery({
    table: "orders",
    fields: ["id", "status"],
    filters: { tenant_id: "t1", status: "PAID" },
    limit: 50
  });

  assert.equal(
    compiled.sql,
    'SELECT "id", "status" FROM "orders" WHERE "tenant_id" = $1 AND "status" = $2 LIMIT 50'
  );
  assert.deepEqual(compiled.params, ["t1", "PAID"]);
});
