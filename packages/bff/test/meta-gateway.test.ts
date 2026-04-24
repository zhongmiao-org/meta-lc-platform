import assert from "node:assert/strict";
import test from "node:test";
import { AggregationService } from "../src/application/services/aggregation.service";
import { MetaQueryService } from "../src/application/services/meta-query.service";
import { MetaRegistryService } from "../src/application/services/meta-registry.service";
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

test("aggregation summary returns resource counts and updated timestamps", async () => {
  const registry = new MetaRegistryService();
  const aggregation = new AggregationService(registry);

  const summary = aggregation.summarizeMeta();

  assert.equal(summary.tables.count, 1);
  assert.equal(summary.pages.count, 1);
  assert.equal(summary.datasources.count, 1);
  assert.equal(summary.rules.count, 1);
  assert.equal(summary.permissions.count, 1);
  assert.equal(summary.tables.updatedAt, "2026-04-20T00:00:00.000Z");
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
  return new MetaController(new MetaQueryService(registry, new CacheService(), new AggregationService(registry)));
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
