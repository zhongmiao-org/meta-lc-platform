import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { RuntimeAuditEvent } from "@zhongmiao/meta-lc-audit";
import { ViewController } from "../src/controller/http/view.controller";
import { MetaRegistryService } from "../src/infra/integration/meta-registry.service";

test("view gateway executes runtime view and propagates context into the query node", async () => {
  const queryCalls: Array<{ kind: string; sql: string; params: unknown[] }> = [];
  const auditEvents: RuntimeAuditEvent[] = [];
  const registry = new MetaRegistryService();
  const controller = new ViewController(
    registry,
    {
      async resolveContext(input: { tenantId: string; userId: string; roles: string[] }) {
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
    } as never,
    {
      create() {
        return {
          auditObserver: {
            recordRuntimeEvent(event: RuntimeAuditEvent) {
              auditEvents.push(event);
            }
          },
          queryDatasource: {
            async execute(request: { kind: "query"; sql: string; params?: unknown[] }) {
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
              throw new Error("mutation should not be called for the fixture view");
            }
          }
        };
      }
    } as never
  );

  const headers: Record<string, string> = {};
  const result = await controller.executeView(
    "orders-workbench",
    {
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
    { headers: { "x-request-id": "req-view-1" } },
    response(headers)
  );

  assert.equal(result.requestId, "req-view-1");
  assert.equal(headers["x-request-id"], "req-view-1");
  assert.deepEqual(
    auditEvents.map((event) => event.type),
    [
      "runtime.plan.started",
      "runtime.permission.decision",
      "runtime.datasource.succeeded",
      "runtime.node.succeeded",
      "runtime.plan.finished"
    ]
  );
  assert.deepEqual(
    auditEvents.map((event) => event.requestId),
    ["req-view-1", "req-view-1", "req-view-1", "req-view-1", "req-view-1"]
  );
  assert.deepEqual(queryCalls, [
    {
      kind: "query",
      sql: 'SELECT "id", "owner", "channel", "priority", "status" FROM "orders" WHERE ("tenant_id" = $1 AND "owner" = $2 AND "created_by" = $3) AND ("tenant_id" = $4 AND ("org_id" IN ($5) OR ("org_id" IS NULL AND "created_by" = $6))) LIMIT 2',
      params: ["tenant-a", "Ada", "user-a", "tenant-a", "dept-a", "user-a"]
    }
  ]);
  assert.deepEqual(result.viewModel, {
    requestId: "req-view-1",
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

test("view gateway returns a stable 404 when the view is missing", async () => {
  const controller = new ViewController(
    new MetaRegistryService(),
    {
      async resolveContext() {
        return {
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["USER"],
          userOrgIds: [],
          rolePolicies: [],
          orgNodes: []
        };
      }
    } as never,
    {
      create() {
        throw new Error("runtime dependencies should not be created");
      }
    } as never
  );

  await assert.rejects(
    () =>
      controller.executeView(
        "missing-view",
        {
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["USER"]
        },
        { headers: { "x-request-id": "req-view-2" } },
        response({})
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.message, 'view "missing-view" not found');
      return true;
    }
  );
});

function response(headers: Record<string, string>): { setHeader(name: string, value: string): void } {
  return {
    setHeader(name: string, value: string): void {
      headers[name] = value;
    }
  };
}
