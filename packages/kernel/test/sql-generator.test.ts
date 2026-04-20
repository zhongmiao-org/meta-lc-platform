import { test } from "node:test";
import assert from "node:assert/strict";
import { compileSchemaSql } from "../src";
import type { MetaSchema } from "../src";

function createCompilerFixture(): MetaSchema {
  return {
    tables: [
      {
        name: "customers",
        fields: [
          { name: "id", type: "uuid" },
          { name: "email", type: "string" }
        ],
        indexes: [{ name: "customers_email_uidx", fields: ["email"], unique: true }]
      },
      {
        name: "orders",
        fields: [
          { name: "id", type: "uuid" },
          { name: "customer_id", type: "uuid" },
          { name: "status", type: "string" },
          { name: "amount", type: "number", nullable: true }
        ],
        indexes: [{ name: "orders_customer_idx", fields: ["customer_id"] }]
      }
    ],
    relations: [
      {
        fromTable: "orders",
        fromField: "customer_id",
        toTable: "customers",
        toField: "id"
      }
    ]
  };
}

test("compileSchemaSql emits stable table, index, and relation statements", () => {
  const compiled = compileSchemaSql(createCompilerFixture());

  assert.deepEqual(compiled.tables, [
    'CREATE TABLE "customers" ("id" UUID NOT NULL, "email" TEXT NOT NULL);',
    'CREATE TABLE "orders" ("id" UUID NOT NULL, "customer_id" UUID NOT NULL, "status" TEXT NOT NULL, "amount" INTEGER);'
  ]);
  assert.deepEqual(compiled.indexes, [
    'CREATE UNIQUE INDEX "customers_email_uidx" ON "customers" ("email");',
    'CREATE INDEX "orders_customer_idx" ON "orders" ("customer_id");'
  ]);
  assert.deepEqual(compiled.relations, [
    'ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");'
  ]);
  assert.deepEqual(compiled.statements, [
    ...compiled.tables,
    ...compiled.indexes,
    ...compiled.relations
  ]);
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
