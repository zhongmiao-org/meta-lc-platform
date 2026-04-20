import { test } from "node:test";
import assert from "node:assert/strict";
import { compileApiRoutes, compilePermissionManifest, compileSchemaSql } from "../src";
import { ordersCompilerFixture } from "./fixtures/compiler-fixtures";

test("compiler fixture defines the public SQL generator contract", () => {
  const compiled = compileSchemaSql(ordersCompilerFixture.schema);

  assert.deepEqual(compiled, ordersCompilerFixture.expected.sql);
});

test("compiler fixture defines the public API route manifest contract", () => {
  const compiled = compileApiRoutes(ordersCompilerFixture.schema);

  assert.deepEqual(compiled, ordersCompilerFixture.expected.api);
});

test("compiler fixture defines the public permission manifest contract", () => {
  const compiled = compilePermissionManifest(ordersCompilerFixture.permissions);

  assert.deepEqual(compiled, ordersCompilerFixture.expected.permission);
});

test("compiler statements are grouped as tables then indexes then relations", () => {
  const compiled = compileSchemaSql(ordersCompilerFixture.schema);

  assert.deepEqual(compiled.statements, [
    ...compiled.tables,
    ...compiled.indexes,
    ...compiled.relations
  ]);
  assert.deepEqual(compiled.statements, ordersCompilerFixture.expected.sql.statements);
});

test("compiler API routes are grouped by schema table order", () => {
  const compiled = compileApiRoutes(ordersCompilerFixture.schema);

  assert.deepEqual(
    compiled.routes.map((route) => route.id),
    ["customers.query", "customers.mutation", "orders.query", "orders.mutation"]
  );
  assert.deepEqual(compiled.routes, ordersCompilerFixture.expected.api.routes);
});

test("compiler permission rules preserve fixture order", () => {
  const compiled = compilePermissionManifest(ordersCompilerFixture.permissions);

  assert.deepEqual(
    compiled.rules.map((rule) => rule.id),
    ["customers.query", "orders.query", "orders.mutation"]
  );
  assert.deepEqual(compiled.rules, ordersCompilerFixture.expected.permission.rules);
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
  const compiledSql = compileSchemaSql(schema);
  const compiledApi = compileApiRoutes(schema);
  const compiledPermission = compilePermissionManifest([]);

  assert.deepEqual(compiledSql, {
    tables: ['CREATE TABLE "audit_logs" ("id" UUID NOT NULL, "status" TEXT NOT NULL);'],
    indexes: [],
    relations: [],
    statements: ['CREATE TABLE "audit_logs" ("id" UUID NOT NULL, "status" TEXT NOT NULL);']
  });
  assert.deepEqual(compiledApi, {
    source: "meta-schema",
    routes: [
      {
        id: "audit_logs.query",
        table: "audit_logs",
        operation: "query",
        method: "POST",
        path: "/api/audit_logs/query",
        target: { method: "POST", path: "/query" },
        requestContract: "QueryApiRequest",
        responseContract: "QueryApiResponse"
      },
      {
        id: "audit_logs.mutation",
        table: "audit_logs",
        operation: "mutation",
        method: "POST",
        path: "/api/audit_logs/mutation",
        target: { method: "POST", path: "/mutation" },
        requestContract: "MutationApiRequest",
        responseContract: "MutationApiResponse"
      }
    ]
  });
  assert.deepEqual(compiledPermission, {
    source: "snapshot-permissions",
    rules: []
  });
  assert.equal(JSON.stringify(schema), before);
});
