import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSchema } from "../src/contracts";

test("validateSchema accepts minimal valid schema", () => {
  assert.doesNotThrow(() =>
    validateSchema({
      tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }] }]
    })
  );
});

test("validateSchema throws for missing tables", () => {
  assert.throws(
    () => validateSchema({} as never),
    /required key: tables/
  );
});
