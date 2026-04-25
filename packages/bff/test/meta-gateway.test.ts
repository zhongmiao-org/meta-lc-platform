import assert from "node:assert/strict";
import test from "node:test";
import { MetaRegistryService } from "../src/infra/integration/meta-registry.service";
import { CacheService } from "../src/infra/cache/cache.service";
import { MetaController } from "../src/controller/http/meta.controller";

test("meta controller returns stable envelope and request id", async () => {
  const controller = createController();
  const headers: Record<string, string> = {};

  const first = await controller.tables(request("req-meta-1"), response(headers));
  const second = await controller.tables(request("req-meta-2"), response(headers));

  assert.equal(first.requestId, "req-meta-1");
  assert.equal(second.requestId, "req-meta-2");
  assert.equal(headers["x-request-id"], "req-meta-2");
  assert.equal(first.source, "memory");
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(first.items[0]?.id, "orders");
});

test("meta registry summary inputs expose resource counts and updated timestamps", async () => {
  const registry = new MetaRegistryService();
  const summary = await new MetaController(registry, new CacheService()).summary(
    request("req-summary-direct"),
    response({})
  );

  assert.equal(summary.summary.tables.count, 1);
  assert.equal(summary.summary.pages.count, 1);
  assert.equal(summary.summary.datasources.count, 1);
  assert.equal(summary.summary.rules.count, 1);
  assert.equal(summary.summary.permissions.count, 1);
  assert.equal(summary.summary.tables.updatedAt, "2026-04-20T00:00:00.000Z");
});

test("meta summary endpoint uses cached aggregation envelope", async () => {
  const controller = createController();
  const headers: Record<string, string> = {};

  const first = await controller.summary(request("req-summary-1"), response(headers));
  const second = await controller.summary(request("req-summary-2"), response(headers));

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.summary.permissions.count, 1);
});

function createController(): MetaController {
  const registry = new MetaRegistryService();
  return new MetaController(registry, new CacheService());
}

function request(requestId: string): { headers: Record<string, string> } {
  return { headers: { "x-request-id": requestId } };
}

function response(headers: Record<string, string>): { setHeader(name: string, value: string): void } {
  return {
    setHeader(name: string, value: string): void {
      headers[name] = value;
    }
  };
}
