import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSelectQueryAst,
  compileSelectAst,
  compileSelectQuery
} from "../src/domain/query-compiler";
import type { SelectQueryAst } from "../src/types";

test("buildSelectQueryAst builds a select AST from legacy query request", () => {
  const ast = buildSelectQueryAst({
    table: "orders",
    fields: ["id", "status"],
    filters: { tenant_id: "t1", status: "PAID" },
    limit: 50
  });

  assert.deepEqual(ast, {
    type: "select",
    table: { name: "orders" },
    fields: [{ name: "id" }, { name: "status" }],
    where: {
      type: "logical",
      operator: "and",
      predicates: [
        {
          type: "comparison",
          left: { name: "tenant_id" },
          operator: "eq",
          value: "t1"
        },
        {
          type: "comparison",
          left: { name: "status" },
          operator: "eq",
          value: "PAID"
        }
      ]
    },
    limit: 50
  });
});

test("buildSelectQueryAst maps keyword filter to structured ILIKE OR predicate", () => {
  const ast = buildSelectQueryAst({
    table: "orders",
    fields: ["id"],
    filters: { keyword: "SO-" }
  });

  assert.deepEqual(ast.where, {
    type: "logical",
    operator: "and",
    predicates: [
      {
        type: "logical",
        operator: "or",
        predicates: [
          {
            type: "comparison",
            left: { name: "id" },
            operator: "ilike",
            value: "%SO-%"
          },
          {
            type: "comparison",
            left: { name: "owner" },
            operator: "ilike",
            value: "%SO-%"
          }
        ]
      }
    ]
  });
});

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

test("compileSelectQuery keeps SQL and params separated for keyword filters", () => {
  const compiled = compileSelectQuery({
    table: "orders",
    fields: ["id", "owner"],
    filters: { keyword: "SO-" }
  });

  assert.equal(
    compiled.sql,
    'SELECT "id", "owner" FROM "orders" WHERE ("id" ILIKE $1 OR "owner" ILIKE $2) LIMIT 100'
  );
  assert.deepEqual(compiled.params, ["%SO-%", "%SO-%"]);
});

test("compileSelectAst compiles permission-transformed AST predicates", () => {
  const ast: SelectQueryAst = {
    type: "select",
    table: { name: "orders", alias: "o" },
    fields: [
      { name: "id", tableAlias: "o" },
      { name: "owner", tableAlias: "o" }
    ],
    where: {
      type: "logical",
      operator: "and",
      predicates: [
        {
          type: "comparison",
          left: { name: "tenant_id", tableAlias: "o" },
          operator: "eq",
          value: "tenant-a"
        },
        {
          type: "logical",
          operator: "or",
          predicates: [
            {
              type: "comparison",
              left: { name: "org_id", tableAlias: "o" },
              operator: "eq",
              value: "dept-a"
            },
            {
              type: "comparison",
              left: { name: "org_id", tableAlias: "o" },
              operator: "eq",
              value: "dept-b"
            }
          ]
        }
      ]
    },
    limit: 20
  };

  const compiled = compileSelectAst(ast);

  assert.equal(
    compiled.sql,
    'SELECT "o"."id", "o"."owner" FROM "orders" AS "o" WHERE "o"."tenant_id" = $1 AND ("o"."org_id" = $2 OR "o"."org_id" = $3) LIMIT 20'
  );
  assert.deepEqual(compiled.params, ["tenant-a", "dept-a", "dept-b"]);
});

test("compileSelectAst compiles permission predicate shapes", () => {
  const ast: SelectQueryAst = {
    type: "select",
    table: { name: "orders", alias: "o" },
    fields: [{ name: "id", tableAlias: "o" }],
    where: {
      type: "logical",
      operator: "and",
      predicates: [
        {
          type: "in",
          left: { name: "org_id", tableAlias: "o" },
          values: ["dept-a", "dept-b"]
        },
        {
          type: "logical",
          operator: "or",
          predicates: [
            {
              type: "is_null",
              left: { name: "deleted_at", tableAlias: "o" }
            },
            {
              type: "literal",
              value: false
            }
          ]
        }
      ]
    },
    limit: 20
  };

  const compiled = compileSelectAst(ast);

  assert.equal(
    compiled.sql,
    'SELECT "o"."id" FROM "orders" AS "o" WHERE "o"."org_id" IN ($1, $2) AND ("o"."deleted_at" IS NULL OR FALSE) LIMIT 20'
  );
  assert.deepEqual(compiled.params, ["dept-a", "dept-b"]);
});

test("compileSelectAst compiles empty IN as deny-all predicate", () => {
  const compiled = compileSelectAst({
    type: "select",
    table: { name: "orders" },
    fields: [{ name: "id" }],
    where: {
      type: "in",
      left: { name: "org_id" },
      values: []
    },
    limit: 10
  });

  assert.equal(compiled.sql, 'SELECT "id" FROM "orders" WHERE FALSE LIMIT 10');
  assert.deepEqual(compiled.params, []);
});

test("compileSelectQuery rejects invalid identifiers", () => {
  assert.throws(
    () => compileSelectQuery({ table: "orders;drop", fields: ["id"] }),
    /Invalid identifier: orders;drop/
  );
  assert.throws(
    () => compileSelectQuery({ table: "orders", fields: ["id;drop"] }),
    /Invalid identifier: id;drop/
  );
  assert.throws(
    () =>
      compileSelectAst({
        type: "select",
        table: { name: "orders" },
        fields: [{ name: "id" }],
        where: {
          type: "comparison",
          left: { name: "tenant_id;drop" },
          operator: "eq",
          value: "t1"
        },
        limit: 10
      }),
    /Invalid identifier: tenant_id;drop/
  );
});

test("compileSelectQuery rejects empty fields", () => {
  assert.throws(
    () => compileSelectQuery({ table: "orders", fields: [] }),
    /At least one field is required/
  );
});

test("compileSelectQuery normalizes limits", () => {
  assert.equal(
    compileSelectQuery({ table: "orders", fields: ["id"] }).sql,
    'SELECT "id" FROM "orders" LIMIT 100'
  );
  assert.equal(
    compileSelectQuery({ table: "orders", fields: ["id"], limit: 0 }).sql,
    'SELECT "id" FROM "orders" LIMIT 1'
  );
  assert.equal(
    compileSelectQuery({ table: "orders", fields: ["id"], limit: 10.8 }).sql,
    'SELECT "id" FROM "orders" LIMIT 10'
  );
  assert.equal(
    compileSelectQuery({ table: "orders", fields: ["id"], limit: Number.NaN }).sql,
    'SELECT "id" FROM "orders" LIMIT 100'
  );
});

test("compileSelectAst rejects empty logical predicates", () => {
  assert.throws(
    () =>
      compileSelectAst({
        type: "select",
        table: { name: "orders" },
        fields: [{ name: "id" }],
        where: { type: "logical", operator: "and", predicates: [] },
        limit: 10
      }),
    /Logical predicate requires at least one child predicate/
  );
});
