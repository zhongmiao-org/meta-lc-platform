import assert from "node:assert/strict";
import test from "node:test";
import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ViewController } from "../src/interface/gateway/view.controller";
import type { ViewApiRequest } from "../src/application/view/view.contract";

test("view controller returns the runtime view model and request id", async () => {
  const headers: Record<string, string> = {};
  const controller = new ViewController({
    async execute() {
      return {
        requestId: "req-from-adapter",
        viewName: "orders-workbench",
        runtime: {
          viewModel: {
            rows: [{ id: "order-1" }]
          }
        }
      };
    }
  } as never);

  const result = await controller.executeView(
    "orders-workbench",
    request({
      tenantId: "tenant-a",
      userId: "user-a",
      roles: ["USER"]
    }),
    { headers: { "x-request-id": "req-view-1" } },
    response(headers)
  );

  assert.equal(headers["x-request-id"], "req-view-1");
  assert.deepEqual(result, {
    requestId: "req-view-1",
    viewModel: {
      rows: [{ id: "order-1" }]
    }
  });
});

test("view controller passes 404s through and maps runtime errors to a stable 500", async () => {
  const missingController = new ViewController({
    async execute() {
      throw new NotFoundException('view "missing-view" not found');
    }
  } as never);
  const runtimeFailController = new ViewController({
    async execute() {
      throw new Error("boom");
    }
  } as never);

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

function response(headers: Record<string, string>): { setHeader(name: string, value: string): void } {
  return {
    setHeader(name: string, value: string): void {
      headers[name] = value;
    }
  };
}
