import assert from "node:assert/strict";
import test from "node:test";
import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ViewController } from "../src/controller/http/view.controller";
import { MetaRegistryService } from "../src/infra/integration/meta-registry.service";
import type { ViewApiRequest } from "../src/contracts/types/view.type";

test("view controller returns the runtime view model and request id", async () => {
  const headers: Record<string, string> = {};
  const controller = new ViewController(
    new MetaRegistryService(),
    {
      async resolveContext(input: { tenantId: string; userId: string; roles: string[] }) {
        return {
          tenantId: input.tenantId,
          userId: input.userId,
          roles: input.roles,
          userOrgIds: [],
          rolePolicies: [],
          orgNodes: []
        };
      }
    } as never,
    {
      create() {
        return {
          queryDatasource: {
            async execute() {
              return {
                rows: [{ id: "order-1" }],
                rowCount: 1,
                metadata: {
                  kind: "query",
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
        };
      }
    } as never
  );

  const result = await controller.executeView(
    "orders-workbench",
    request({
      tenantId: "tenant-a",
      userId: "user-a",
      roles: ["USER"],
      input: {
        owner: "Ada",
        limit: 1
      }
    }),
    { headers: { "x-request-id": "req-view-1" } },
    response(headers)
  );

  assert.equal(headers["x-request-id"], "req-view-1");
  assert.deepEqual(result, {
    requestId: "req-view-1",
    viewModel: {
      requestId: "req-view-1",
      tenantId: "tenant-a",
      owner: "Ada",
      rows: [{ id: "order-1" }]
    }
  });
});

test("view controller passes 404s through and maps runtime errors to a stable 500", async () => {
  const missingController = createFailingController();
  const runtimeFailController = createFailingController(true);

  await assert.rejects(
    () =>
      missingController.executeView(
        "missing-view",
        request({
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["USER"]
        }),
        { headers: {} },
        response({})
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      return true;
    }
  );

  await assert.rejects(
    () =>
      runtimeFailController.executeView(
        "orders-workbench",
        request({
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["USER"]
        }),
        { headers: {} },
        response({})
      ),
    (error: unknown) => {
      assert.ok(error instanceof InternalServerErrorException);
      assert.equal(error.message, 'runtime execution failed for view "orders-workbench"');
      return true;
    }
  );
});

function request(body: ViewApiRequest): ViewApiRequest {
  return body;
}

function createFailingController(runtimeFails = false): ViewController {
  return new ViewController(
    new MetaRegistryService(),
    {
      async resolveContext(input: { tenantId: string; userId: string; roles: string[] }) {
        return {
          tenantId: input.tenantId,
          userId: input.userId,
          roles: input.roles,
          userOrgIds: [],
          rolePolicies: [],
          orgNodes: []
        };
      }
    } as never,
    {
      create() {
        if (runtimeFails) {
          throw new Error("boom");
        }
        return {
          queryDatasource: {
            async execute() {
              return {
                rows: [],
                rowCount: 0,
                metadata: {
                  kind: "query",
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
        };
      }
    } as never
  );
}

function response(headers: Record<string, string>): { setHeader(name: string, value: string): void } {
  return {
    setHeader(name: string, value: string): void {
      headers[name] = value;
    }
  };
}
