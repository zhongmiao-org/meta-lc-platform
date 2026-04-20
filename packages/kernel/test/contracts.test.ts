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

test("validateSchema accepts indexes and relations", () => {
  assert.doesNotThrow(() =>
    validateSchema({
      tables: [
        {
          name: "customers",
          fields: [{ name: "id", type: "uuid" }],
          indexes: [{ name: "customers_id_uidx", fields: ["id"], unique: true }]
        },
        {
          name: "orders",
          fields: [
            { name: "id", type: "uuid" },
            { name: "customer_id", type: "uuid" }
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
    })
  );
});

test("validateSchema rejects duplicate index names and empty index fields", () => {
  assert.throws(
    () =>
      validateSchema({
        tables: [
          {
            name: "orders",
            fields: [{ name: "id", type: "uuid" }],
            indexes: [
              { name: "orders_id_idx", fields: ["id"] },
              { name: "orders_id_idx", fields: ["id"] }
            ]
          }
        ]
      }),
    /Duplicate index name "orders_id_idx" in table orders/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [
          {
            name: "orders",
            fields: [{ name: "id", type: "uuid" }],
            indexes: [{ name: "orders_empty_idx", fields: [] }]
          }
        ]
      }),
    /must define at least one field/
  );
});

test("validateSchema rejects relations to missing tables or fields", () => {
  assert.throws(
    () =>
      validateSchema({
        tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }] }],
        relations: [
          {
            fromTable: "orders",
            fromField: "customer_id",
            toTable: "customers",
            toField: "id"
          }
        ]
      }),
    /unknown fromField "customer_id"/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [
          {
            name: "orders",
            fields: [
              { name: "id", type: "uuid" },
              { name: "customer_id", type: "uuid" }
            ]
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
      }),
    /unknown toTable "customers"/
  );
});
