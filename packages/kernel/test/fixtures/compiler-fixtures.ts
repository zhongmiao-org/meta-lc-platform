import type { CompiledApiRouteManifest, CompiledSchemaSql, MetaSchema } from "../../src";

export interface CompilerFixture {
  schema: MetaSchema;
  expected: {
    sql: CompiledSchemaSql;
    api: CompiledApiRouteManifest;
  };
}

export const ordersCompilerFixture: CompilerFixture = {
  schema: {
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
  },
  expected: {
    sql: {
      tables: [
        'CREATE TABLE "customers" ("id" UUID NOT NULL, "email" TEXT NOT NULL);',
        'CREATE TABLE "orders" ("id" UUID NOT NULL, "customer_id" UUID NOT NULL, "status" TEXT NOT NULL, "amount" INTEGER);'
      ],
      indexes: [
        'CREATE UNIQUE INDEX "customers_email_uidx" ON "customers" ("email");',
        'CREATE INDEX "orders_customer_idx" ON "orders" ("customer_id");'
      ],
      relations: [
        'ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");'
      ],
      statements: [
        'CREATE TABLE "customers" ("id" UUID NOT NULL, "email" TEXT NOT NULL);',
        'CREATE TABLE "orders" ("id" UUID NOT NULL, "customer_id" UUID NOT NULL, "status" TEXT NOT NULL, "amount" INTEGER);',
        'CREATE UNIQUE INDEX "customers_email_uidx" ON "customers" ("email");',
        'CREATE INDEX "orders_customer_idx" ON "orders" ("customer_id");',
        'ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id");'
      ]
    },
    api: {
      source: "meta-schema",
      routes: [
        {
          id: "customers.query",
          table: "customers",
          operation: "query",
          method: "POST",
          path: "/api/customers/query",
          target: { method: "POST", path: "/query" },
          requestContract: "QueryApiRequest",
          responseContract: "QueryApiResponse"
        },
        {
          id: "customers.mutation",
          table: "customers",
          operation: "mutation",
          method: "POST",
          path: "/api/customers/mutation",
          target: { method: "POST", path: "/mutation" },
          requestContract: "MutationApiRequest",
          responseContract: "MutationApiResponse"
        },
        {
          id: "orders.query",
          table: "orders",
          operation: "query",
          method: "POST",
          path: "/api/orders/query",
          target: { method: "POST", path: "/query" },
          requestContract: "QueryApiRequest",
          responseContract: "QueryApiResponse"
        },
        {
          id: "orders.mutation",
          table: "orders",
          operation: "mutation",
          method: "POST",
          path: "/api/orders/mutation",
          target: { method: "POST", path: "/mutation" },
          requestContract: "MutationApiRequest",
          responseContract: "MutationApiResponse"
        }
      ]
    }
  }
};
