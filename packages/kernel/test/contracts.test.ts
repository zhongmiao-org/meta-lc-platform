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

test("validateSchema accepts tenant, app, rule, and permission metadata", () => {
  assert.doesNotThrow(() =>
    validateSchema({
      tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }] }],
      tenants: [{ id: "tenant-a", name: "Tenant A", status: "active" }],
      apps: [{ id: "sales-app", tenantId: "tenant-a", name: "Sales App", status: "active" }],
      rules: [{ id: "refresh-orders", appId: "sales-app", trigger: "mutation.succeeded" }],
      permissions: [{ resource: "orders", action: "query", roles: ["SALES", "ADMIN"] }]
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

test("validateSchema rejects duplicate tenant, app, and rule ids", () => {
  assert.throws(
    () =>
      validateSchema({
        tables: [],
        tenants: [
          { id: "tenant-a", name: "Tenant A" },
          { id: "tenant-a", name: "Tenant A Duplicate" }
        ]
      }),
    /Duplicate tenant id: tenant-a/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [],
        tenants: [{ id: "tenant-a", name: "Tenant A" }],
        apps: [
          { id: "sales-app", tenantId: "tenant-a", name: "Sales App" },
          { id: "sales-app", tenantId: "tenant-a", name: "Sales App Duplicate" }
        ]
      }),
    /Duplicate app id: sales-app/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [],
        tenants: [{ id: "tenant-a", name: "Tenant A" }],
        apps: [{ id: "sales-app", tenantId: "tenant-a", name: "Sales App" }],
        rules: [
          { id: "refresh-orders", appId: "sales-app", trigger: "mutation.succeeded" },
          { id: "refresh-orders", appId: "sales-app", trigger: "state.changed" }
        ]
      }),
    /Duplicate rule id: refresh-orders/
  );
});

test("validateSchema rejects invalid app and rule references", () => {
  assert.throws(
    () =>
      validateSchema({
        tables: [],
        apps: [{ id: "sales-app", tenantId: "tenant-a", name: "Sales App" }]
      }),
    /App sales-app references unknown tenant "tenant-a"/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [],
        tenants: [{ id: "tenant-a", name: "Tenant A" }],
        apps: [{ id: "sales-app", tenantId: "tenant-a", name: "Sales App" }],
        rules: [{ id: "refresh-orders", appId: "missing-app", trigger: "mutation.succeeded" }]
      }),
    /Rule refresh-orders references unknown app "missing-app"/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [],
        tenants: [{ id: "tenant-a", name: "Tenant A" }],
        apps: [{ id: "sales-app", tenantId: "tenant-a", name: "Sales App" }],
        rules: [{ id: "refresh-orders", appId: "sales-app", trigger: "" }]
      }),
    /Rule refresh-orders requires a trigger/
  );
});

test("validateSchema rejects invalid permissions", () => {
  assert.throws(
    () =>
      validateSchema({
        tables: [],
        permissions: [{ resource: "", action: "query", roles: ["ADMIN"] }]
      }),
    /Permission requires a resource/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [],
        permissions: [{ resource: "orders", action: "", roles: ["ADMIN"] }]
      }),
    /Permission orders requires an action/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [],
        permissions: [{ resource: "orders", action: "query", roles: [] }]
      }),
    /Permission orders:query requires at least one role/
  );

  assert.throws(
    () =>
      validateSchema({
        tables: [],
        permissions: [{ resource: "orders", action: "query", roles: ["ADMIN", "ADMIN"] }]
      }),
    /Permission orders:query has duplicate role "ADMIN"/
  );
});
