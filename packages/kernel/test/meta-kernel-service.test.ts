import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryMetaKernelRepository, MetaKernelService } from "../src";
import type { MetaVersion } from "../src/core/interfaces";

function createVersion(version: number, schema: MetaVersion["schema"]): MetaVersion {
  return {
    appId: "demo-app",
    version,
    schema,
    metadata: {
      author: "tester",
      message: "test",
      createdAt: new Date().toISOString(),
      rollbackFromVersion: null
    }
  };
}

test("buildMigrationPlan returns SQL statements between versions", async () => {
  const versions = new Map<number, MetaVersion>([
    [1, createVersion(1, { tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }] }] })],
    [
      2,
      createVersion(2, {
        tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }, { name: "status", type: "string" }] }]
      })
    ]
  ]);

  const repository = {
    init: async () => {},
    createVersion: async () => {
      throw new Error("not used in test");
    },
    getVersion: async (_appId: string, version: number) => versions.get(version) ?? null,
    executeMigration: async (_statements: string[]) => ({ auditCount: 0 }),
    ...definitionRepositoryStubs()
  };

  const service = new MetaKernelService(repository);
  const result = await service.buildMigrationPlan("demo-app", 1, 2);

  assert.equal(result.applied, false);
  assert.deepEqual(result.statements, ['ALTER TABLE "orders" ADD COLUMN "status" TEXT NOT NULL;']);
  assert.deepEqual(result.destructiveStatements, []);
  assert.equal(result.auditCount, 0);
});

test("replayFromVersion executes migrations sequentially", async () => {
  const versions = new Map<number, MetaVersion>([
    [1, createVersion(1, { tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }] }] })],
    [
      2,
      createVersion(2, {
        tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }, { name: "status", type: "string" }] }]
      })
    ],
    [
      3,
      createVersion(3, {
        tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }, { name: "status", type: "number" }] }]
      })
    ]
  ]);

  const executed: string[][] = [];
  const repository = {
    init: async () => {},
    createVersion: async () => {
      throw new Error("not used in test");
    },
    getVersion: async (_appId: string, version: number) => versions.get(version) ?? null,
    executeMigration: async (statements: string[]) => {
      executed.push(statements);
      return { auditCount: statements.length };
    },
    ...definitionRepositoryStubs()
  };

  const service = new MetaKernelService(repository);
  const replayResults = await service.replayFromVersion("demo-app", 1);

  assert.equal(replayResults.length, 2);
  assert.equal(replayResults[0].fromVersion, 1);
  assert.equal(replayResults[0].toVersion, 2);
  assert.equal(replayResults[1].fromVersion, 2);
  assert.equal(replayResults[1].toVersion, 3);
  assert.equal(replayResults[0].auditCount, 1);
  assert.equal(replayResults[1].auditCount, 1);
  assert.equal(executed.length, 2);
  assert.deepEqual(executed[0], ['ALTER TABLE "orders" ADD COLUMN "status" TEXT NOT NULL;']);
  assert.deepEqual(executed[1], ['ALTER TABLE "orders" ALTER COLUMN "status" TYPE INTEGER;']);
});

test("migrateToVersion passes guard options to repository", async () => {
  const versions = new Map<number, MetaVersion>([
    [1, createVersion(1, { tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }] }] })],
    [
      2,
      createVersion(2, {
        tables: [{ name: "orders", fields: [{ name: "id", type: "uuid" }, { name: "status", type: "string" }] }]
      })
    ]
  ]);

  const optionsSeen: unknown[] = [];
  const contextSeen: unknown[] = [];
  const repository = {
    init: async () => {},
    createVersion: async () => {
      throw new Error("not used in test");
    },
    getVersion: async (_appId: string, version: number) => versions.get(version) ?? null,
    executeMigration: async (_statements: string[], options?: unknown, context?: unknown) => {
      optionsSeen.push(options);
      contextSeen.push(context);
      return { auditCount: 1 };
    },
    ...definitionRepositoryStubs()
  };

  const service = new MetaKernelService(repository);
  const result = await service.migrateToVersion("demo-app", 1, 2, {
    allowDestructive: false,
    requestId: "req-1"
  });

  assert.equal(result.auditCount, 1);
  assert.equal(optionsSeen.length, 1);
  assert.deepEqual(optionsSeen[0], {
    allowDestructive: false,
    destructiveStatementAllowlist: undefined
  });
  assert.equal(contextSeen.length, 1);
  assert.deepEqual(contextSeen[0], {
    appId: "demo-app",
    fromVersion: 1,
    toVersion: 2,
    requestId: "req-1"
  });
});

test("publishes and fetches versioned view definitions", async () => {
  const service = new MetaKernelService(new InMemoryMetaKernelRepository());
  const first = await service.publishViewDefinition({
    appId: "demo-app",
    definition: createOrdersView(["id"]),
    author: "tester",
    message: "Publish orders view"
  });
  const second = await service.publishViewDefinition({
    appId: "demo-app",
    definition: createOrdersView(["id", "owner"]),
    author: "tester",
    message: "Add owner field"
  });

  assert.equal(first.version, 1);
  assert.equal(second.version, 2);
  assert.equal(second.id, "orders-workbench");
  assert.deepEqual((await service.getViewDefinition("demo-app", "orders-workbench", 1))?.definition, first.definition);
  assert.deepEqual((await service.getViewDefinition("demo-app", "orders-workbench"))?.definition, second.definition);
});

test("diffDefinition returns stable changed paths for view versions", async () => {
  const service = new MetaKernelService(new InMemoryMetaKernelRepository());
  await service.publishViewDefinition({
    appId: "demo-app",
    definition: createOrdersView(["id"]),
    author: "tester",
    message: "Publish orders view"
  });
  await service.publishViewDefinition({
    appId: "demo-app",
    definition: createOrdersView(["id", "owner"]),
    author: "tester",
    message: "Add owner field"
  });

  const diff = await service.diffDefinition({
    appId: "demo-app",
    kind: "view",
    id: "orders-workbench",
    fromVersion: 1,
    toVersion: 2
  });

  assert.deepEqual(diff.changedPaths, ["nodes.orders.fields.1"]);
});

test("publishes and fetches datasource definitions", async () => {
  const service = new MetaKernelService(new InMemoryMetaKernelRepository());
  const published = await service.publishDatasourceDefinition({
    appId: "demo-app",
    definition: {
      id: "orders-query",
      type: "postgres",
      config: { target: "business" }
    },
    author: "tester",
    message: "Publish datasource"
  });

  assert.equal(published.version, 1);
  assert.deepEqual(await service.getDatasourceDefinition("demo-app", "orders-query"), published);
});

test("rejects invalid datasource definitions", async () => {
  const service = new MetaKernelService(new InMemoryMetaKernelRepository());

  await assert.rejects(
    () =>
      service.publishDatasourceDefinition({
        appId: "demo-app",
        definition: {
          id: "orders-query",
          type: ""
        },
        author: "tester",
        message: "Invalid datasource"
      }),
    /requires a type/
  );
});

test("publishes and fetches permission policies", async () => {
  const service = new MetaKernelService(new InMemoryMetaKernelRepository());
  const published = await service.publishPermissionPolicy({
    appId: "demo-app",
    definition: {
      id: "orders-query-policy",
      resource: "orders",
      action: "query",
      roles: ["SALES"],
      scope: "DEPT"
    },
    author: "tester",
    message: "Publish permission policy"
  });

  assert.equal(published.version, 1);
  assert.deepEqual(await service.getPermissionPolicy("demo-app", "orders-query-policy"), published);
});

test("rejects invalid permission policies", async () => {
  const service = new MetaKernelService(new InMemoryMetaKernelRepository());

  await assert.rejects(
    () =>
      service.publishPermissionPolicy({
        appId: "demo-app",
        definition: {
          id: "orders-query-policy",
          resource: "orders",
          action: "query",
          roles: ["SALES", "SALES"]
        },
        author: "tester",
        message: "Invalid permission policy"
      }),
    /duplicate role "SALES"/
  );

  await assert.rejects(
    () =>
      service.publishPermissionPolicy({
        appId: "demo-app",
        definition: {
          id: "orders-query-policy",
          resource: "orders",
          action: "query",
          roles: [""]
        },
        author: "tester",
        message: "Invalid permission policy"
      }),
    /empty role/
  );
});

function createOrdersView(fields: string[]) {
  return {
    name: "orders-workbench",
    nodes: {
      orders: {
        type: "query" as const,
        table: "orders",
        fields
      }
    },
    output: {
      rows: "{{orders.rows}}"
    }
  };
}

function definitionRepositoryStubs() {
  return {
    createDefinitionVersion: async () => {
      throw new Error("not used in test");
    },
    getDefinitionVersion: async () => null,
    getLatestDefinitionVersion: async () => null,
    listLatestDefinitionVersions: async () => []
  };
}
