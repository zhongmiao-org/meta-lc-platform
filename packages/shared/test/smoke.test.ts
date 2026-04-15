import test from "node:test";
import assert from "node:assert/strict";
import { formatSqlWithParams, shiftSqlParams } from "../src";

test("shared helpers format sql", () => {
  assert.equal(formatSqlWithParams("SELECT * FROM t WHERE id = $1", [12]), "SELECT * FROM t WHERE id = 12");
  assert.equal(shiftSqlParams("tenant_id = $1 AND user_id = $2", 2), "tenant_id = $3 AND user_id = $4");
});
