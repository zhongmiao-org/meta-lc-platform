import { test } from "node:test";
import assert from "node:assert/strict";
import { compileApiRoutes } from "../src";
import { ordersCompilerFixture } from "./fixtures/compiler-fixtures";

test("compileApiRoutes emits stable query and mutation route manifests", () => {
  const compiled = compileApiRoutes(ordersCompilerFixture.schema);

  assert.deepEqual(compiled, ordersCompilerFixture.expected.api);
});

test("compileApiRoutes preserves schema table order", () => {
  const compiled = compileApiRoutes(ordersCompilerFixture.schema);

  assert.deepEqual(
    compiled.routes.map((route) => route.path),
    ["/api/customers/query", "/api/customers/mutation", "/api/orders/query", "/api/orders/mutation"]
  );
});

test("compileApiRoutes rejects invalid identifiers before emitting routes", () => {
  assert.throws(
    () =>
      compileApiRoutes({
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
