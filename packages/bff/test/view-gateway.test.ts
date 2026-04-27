import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { RuntimeGatewayRequestError, RuntimeViewNotFoundError } from "@zhongmiao/meta-lc-runtime";
import { ViewController } from "../src/controller/http/view.controller";
import type { ViewApiRequest } from "../src/types/view.type";

test("view controller delegates execution to the runtime gateway facade", async () => {
  const headers: Record<string, string> = {};
  const calls: Array<{ viewName: string; request: ViewApiRequest & { requestId: string } }> = [];
  const controller = new ViewController();
  controller.runtimeRunner = async (viewName, request) => {
    calls.push({ viewName, request });
    return {
      viewModel: {
        requestId: request.requestId,
        tenantId: request.tenantId,
        owner: request.input?.owner,
        rows: [{ id: "order-1" }]
      }
    };
  };

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
  assert.deepEqual(calls, [
    {
      viewName: "orders-workbench",
      request: {
        tenantId: "tenant-a",
        userId: "user-a",
        roles: ["USER"],
        input: {
          owner: "Ada",
          limit: 1
        },
        requestId: "req-view-1"
      }
    }
  ]);
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

test("view controller maps runtime missing view and runtime errors to stable HTTP errors", async () => {
  const missingController = new ViewController();
  missingController.runtimeRunner = async (viewName) => {
    throw new RuntimeViewNotFoundError(viewName);
  };
  const invalidRequestController = new ViewController();
  invalidRequestController.runtimeRunner = async () => {
    throw new RuntimeGatewayRequestError("tenantId and userId are required.");
  };
  const runtimeFailController = new ViewController();
  runtimeFailController.runtimeRunner = async () => {
    throw new Error("boom");
  };

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
      assert.equal(error.message, 'view "missing-view" not found');
      return true;
    }
  );

  await assert.rejects(
    () =>
      invalidRequestController.executeView(
        "orders-workbench",
        request({
          tenantId: "",
          userId: "user-a",
          roles: ["USER"]
        }),
        { headers: {} },
        response({})
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.message, "tenantId and userId are required.");
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
