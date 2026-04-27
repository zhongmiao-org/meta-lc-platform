import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryMetaKernelService,
  MetaKernelService,
  type ViewDefinition
} from "@zhongmiao/meta-lc-kernel";
import {
  RuntimeViewNotFoundError,
  executeRuntimeGatewayView,
  executeRuntimeView
} from "./runtime-test-api";

test("executeRuntimeView compiles a view and executes through the runtime entrypoint", async () => {
  const view: ViewDefinition = {
    name: "orders-workbench",
    nodes: {
      orders: {
        type: "query",
        table: "orders",
        fields: ["id", "owner"],
        filters: {
          tenant_id: "{{input.tenantId}}"
        }
      }
    },
    output: {
      rows: "{{orders.rows}}",
      firstOwner: "{{orders.row.owner}}"
    }
  };
  const queryCalls: Array<{ kind: string; sql: string; params: unknown[] }> = [];

  const result = await executeRuntimeView(
    view,
    {
      tenantId: "tenant-a",
      userId: "user-1",
      roles: ["USER"],
      input: {
        tenantId: "tenant-a"
      }
    },
    {
      queryDatasource: {
        async execute(request) {
          queryCalls.push({
            kind: request.kind,
            sql: request.sql,
            params: request.params ?? []
          });
          return {
            rows: [{ id: "order-1", owner: "Ada" }],
            rowCount: 1,
            metadata: {
              kind: request.kind,
              durationMs: 1
            }
          };
        }
      },
      mutationDatasource: {
        async execute() {
          throw new Error("mutation adapter should not be called");
        }
      }
    }
  );

  assert.deepEqual(queryCalls, [
    {
      kind: "query",
      sql: 'SELECT "id", "owner" FROM "orders" WHERE ("tenant_id" = $1) AND ("tenant_id" = $2 AND "created_by" = $3) LIMIT 100',
      params: ["tenant-a", "tenant-a", "user-1"]
    }
  ]);
  assert.deepEqual(result.viewModel, {
    rows: [{ id: "order-1", owner: "Ada" }],
    firstOwner: "Ada"
  });
});

test("executeRuntimeGatewayView owns view lookup, context build, org scope, datasource, and audit wiring", async () => {
  const queryCalls: Array<{ kind: string; sql: string; params: unknown[] }> = [];
  const auditEvents: string[] = [];

  const result = await executeRuntimeGatewayView(
    "orders-workbench",
    {
      requestId: "req-gateway-1",
      tenantId: "tenant-a",
      userId: "user-a",
      roles: ["MANAGER"],
      input: {
        owner: "Ada",
        limit: 2
      },
      context: {
        locale: "zh-CN"
      }
    },
    {
      appId: "runtime-test-app",
      metaKernel: createTestMetaKernel(),
      orgScopeResolver: {
        async resolve(input) {
          assert.deepEqual(input, {
            tenantId: "tenant-a",
            userId: "user-a",
            roles: ["MANAGER"]
          });
          return {
            tenantId: input.tenantId,
            userId: input.userId,
            roles: input.roles,
            userOrgIds: ["dept-a"],
            rolePolicies: [],
            orgNodes: []
          };
        }
      },
      auditObserver: {
        recordRuntimeEvent(event) {
          auditEvents.push(event.type);
        }
      },
      queryDatasource: {
        async execute(request) {
          queryCalls.push({
            kind: request.kind,
            sql: request.sql,
            params: request.params ?? []
          });
          return {
            rows: [
              {
                id: "order-1",
                owner: "Ada",
                channel: "web",
                priority: "medium",
                status: "active"
              }
            ],
            rowCount: 1,
            metadata: {
              kind: request.kind,
              durationMs: 1
            }
          };
        }
      },
      mutationDatasource: {
        async execute() {
          throw new Error("mutation should not run");
        }
      }
    }
  );

  assert.deepEqual(auditEvents, [
    "runtime.plan.started",
    "runtime.permission.decision",
    "runtime.datasource.succeeded",
    "runtime.node.succeeded",
    "runtime.plan.finished"
  ]);
  assert.deepEqual(queryCalls, [
    {
      kind: "query",
      sql: 'SELECT "id", "owner", "channel", "priority", "status" FROM "orders" WHERE ("tenant_id" = $1 AND "owner" = $2 AND "created_by" = $3) AND ("tenant_id" = $4 AND ("org_id" IN ($5) OR ("org_id" IS NULL AND "created_by" = $6))) LIMIT 2',
      params: ["tenant-a", "Ada", "user-a", "tenant-a", "dept-a", "user-a"]
    }
  ]);
  assert.deepEqual(result.viewModel, {
    requestId: "req-gateway-1",
    tenantId: "tenant-a",
    owner: "Ada",
    rows: [
      {
        id: "order-1",
        owner: "Ada",
        channel: "web",
        priority: "medium",
        status: "active"
      }
    ]
  });
});

test("executeRuntimeGatewayView rejects unknown views before creating execution dependencies", async () => {
  await assert.rejects(
    () =>
      executeRuntimeGatewayView(
        "missing-view",
        {
          requestId: "req-missing",
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["USER"]
        },
        {
          appId: "runtime-test-app",
          metaKernel: createTestMetaKernel(),
          queryDatasource: {
            async execute() {
              throw new Error("query should not run");
            }
          },
          mutationDatasource: {
            async execute() {
              throw new Error("mutation should not run");
            }
          },
          orgScopeResolver: {
            async resolve() {
              throw new Error("org scope should not resolve");
            }
          },
          auditObserver: {
            recordRuntimeEvent() {
              throw new Error("audit should not record");
            }
          }
        }
      ),
    RuntimeViewNotFoundError
  );
});

function createTestMetaKernel(): MetaKernelService {
  return createInMemoryMetaKernelService({
    definitions: [
      {
        appId: "runtime-test-app",
        kind: "view",
        id: "orders-workbench",
        definition: {
          name: "orders-workbench",
          nodes: {
            orders: {
              type: "query",
              table: "orders",
              fields: ["id", "owner", "channel", "priority", "status"],
              filters: {
                tenant_id: "{{context.tenantId}}",
                owner: "{{input.owner}}",
                created_by: "{{context.userId}}"
              },
              limit: "{{input.limit}}"
            }
          },
          output: {
            requestId: "{{context.requestId}}",
            tenantId: "{{context.tenantId}}",
            owner: "{{input.owner}}",
            rows: "{{orders.rows}}"
          }
        },
        metadata: {
          author: "runtime-test",
          message: "Seed runtime facade test view",
          createdAt: "2026-04-20T00:00:00.000Z"
        }
      }
    ]
  });
}
