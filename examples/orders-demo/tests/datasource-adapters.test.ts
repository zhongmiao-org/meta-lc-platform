import assert from "node:assert/strict";
import test from "node:test";
import { OrdersDemoMutationAdapter } from "../datasource-adapters.ts";

const dbConfig = {
  host: "127.0.0.1",
  port: 5432,
  user: "lowcode",
  password: "lowcode",
  database: "business_db",
  ssl: false
};

test("OrdersDemoMutationAdapter executes demo orders create mutation through a transaction", async () => {
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
  const adapter = new OrdersDemoMutationAdapter(
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

test("OrdersDemoMutationAdapter rolls back failed demo orders mutation", async () => {
  const failure = new Error("insert failed");
  const client = new FakeClient([{ rows: [], rowCount: null }, failure, { rows: [], rowCount: null }]);
  const adapter = new OrdersDemoMutationAdapter(
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

interface QueryCall {
  sql: string;
  params?: unknown[];
}

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };

class FakeTransactionPool {
  private readonly client: FakeClient;

  constructor(client: FakeClient) {
    this.client = client;
  }

  async connect(): Promise<FakeClient> {
    return this.client;
  }

  async end(): Promise<void> {}
}

class FakeClient {
  readonly calls: QueryCall[] = [];
  released = false;
  private readonly results: Array<QueryResult | Error>;

  constructor(results: Array<QueryResult | Error>) {
    this.results = results;
  }

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
