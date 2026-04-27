import assert from "node:assert/strict";
import test from "node:test";
import { PostgresOrgScopeAdapter } from "../src/infra/postgres/postgres-org-scope.adapter";

const dbConfig = {
  host: "127.0.0.1",
  port: 5432,
  user: "lowcode",
  password: "lowcode",
  database: "business_db",
  ssl: false
};

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
