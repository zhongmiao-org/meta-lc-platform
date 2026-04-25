import assert from "node:assert/strict";
import test from "node:test";
import {
  PostgresOrdersMutationAdapter,
  PostgresOrgScopeAdapter
} from "../src";

const dbConfig = {
  host: "127.0.0.1",
  port: 5432,
  user: "lowcode",
  password: "lowcode",
  database: "business_db",
  ssl: false
};

test("PostgresOrdersMutationAdapter executes orders create mutation through a transaction", async () => {
  const client = new FakeClient([
    { rows: [], rowCount: null },
    {
      rows: [
        {
          id: "order-1",
          owner: "Ada",
          channel: "web",
          priority: "high",
          status: "active",
          tenant_id: "tenant-a",
          created_by: "user-a",
          org_id: "org-a"
        }
      ],
      rowCount: 1
    },
    { rows: [], rowCount: null }
  ]);
  const adapter = new PostgresOrdersMutationAdapter(
    dbConfig,
    new FakeTransactionPool(client) as never
  );

  const result = await adapter.execute({
    model: "orders",
    operation: "create",
    payload: {
      id: "order-1",
      owner: "Ada",
      channel: "web",
      priority: "high",
      status: "active",
      orgId: "org-a"
    },
    context: {
      tenantId: "tenant-a",
      userId: "user-a"
    }
  });

  assert.equal(client.released, true);
  assert.deepEqual(
    client.calls.map((call) => call.sql),
    [
      "BEGIN",
      `INSERT INTO orders (id, owner, channel, priority, status, tenant_id, created_by, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, owner, channel, priority, status, tenant_id, created_by, org_id`,
      "COMMIT"
    ]
  );
  assert.deepEqual(client.calls[1]?.params, [
    "order-1",
    "Ada",
    "web",
    "high",
    "active",
    "tenant-a",
    "user-a",
    "org-a"
  ]);
  assert.equal(result.rowCount, 1);
  assert.equal(result.beforeData, null);
  assert.deepEqual(result.afterData, {
    id: "order-1",
    owner: "Ada",
    channel: "web",
    priority: "high",
    status: "active",
    tenant_id: "tenant-a",
    created_by: "user-a",
    org_id: "org-a"
  });
});

test("PostgresOrdersMutationAdapter rolls back failed orders mutation", async () => {
  const failure = new Error("insert failed");
  const client = new FakeClient([{ rows: [], rowCount: null }, failure, { rows: [], rowCount: null }]);
  const adapter = new PostgresOrdersMutationAdapter(
    dbConfig,
    new FakeTransactionPool(client) as never
  );

  await assert.rejects(
    () =>
      adapter.execute({
        model: "orders",
        operation: "create",
        payload: {
          id: "order-2",
          owner: "Grace"
        },
        context: {
          tenantId: "tenant-a",
          userId: "user-a"
        }
      }),
    failure
  );

  assert.equal(client.released, true);
  assert.deepEqual(
    client.calls.map((call) => call.sql),
    [
      "BEGIN",
      `INSERT INTO orders (id, owner, channel, priority, status, tenant_id, created_by, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, owner, channel, priority, status, tenant_id, created_by, org_id`,
      "ROLLBACK"
    ]
  );
});

test("PostgresOrgScopeAdapter loads org scope data from business datasource", async () => {
  const pool = new FakeQueryPool([
    {
      rows: [{ org_id: "org-a" }, { org_id: "org-b" }],
      rowCount: 2
    },
    {
      rows: [
        {
          role_code: "MANAGER",
          data_scope: "DEPT_AND_CHILDREN",
          custom_org_ids: null
        }
      ],
      rowCount: 1
    },
    {
      rows: [{ role_code: "MANAGER" }],
      rowCount: 1
    },
    {
      rows: [
        {
          id: "org-a",
          tenant_id: "tenant-a",
          parent_id: null,
          path: "/org-a",
          name: "Org A",
          type: "department"
        }
      ],
      rowCount: 1
    }
  ]);
  const adapter = new PostgresOrgScopeAdapter(dbConfig, pool as never);

  const result = await adapter.resolve({
    tenantId: "tenant-a",
    userId: "user-a"
  });

  assert.deepEqual(pool.calls.map((call) => call.params), [
    ["tenant-a", "user-a"],
    ["tenant-a"],
    ["tenant-a", "user-a"],
    ["tenant-a"]
  ]);
  assert.deepEqual(result.userOrgIds, ["org-a", "org-b"]);
  assert.deepEqual(result.roleBindings, ["MANAGER"]);
  assert.deepEqual(result.rolePolicies, [
    {
      role: "MANAGER",
      scope: "DEPT_AND_CHILDREN",
      customOrgIds: []
    }
  ]);
  assert.deepEqual(result.orgNodes, [
    {
      id: "org-a",
      tenantId: "tenant-a",
      parentId: null,
      path: "/org-a",
      name: "Org A",
      type: "department"
    }
  ]);
});

interface QueryCall {
  sql: string;
  params?: unknown[];
}

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };

class FakeTransactionPool {
  constructor(private readonly client: FakeClient) {}

  async connect(): Promise<FakeClient> {
    return this.client;
  }

  async end(): Promise<void> {}
}

class FakeClient {
  readonly calls: QueryCall[] = [];
  released = false;

  constructor(private readonly results: Array<QueryResult | Error>) {}

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.calls.push({ sql, params });
    const result = this.results.shift();
    if (result instanceof Error) {
      throw result;
    }
    if (!result) {
      return { rows: [], rowCount: null };
    }
    return result;
  }

  release(): void {
    this.released = true;
  }
}

class FakeQueryPool {
  readonly calls: QueryCall[] = [];

  constructor(private readonly results: QueryResult[]) {}

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.calls.push({ sql, params });
    const result = this.results.shift();
    assert.ok(result, `missing fake query result for ${sql}`);
    return result;
  }

  async end(): Promise<void> {}
}
