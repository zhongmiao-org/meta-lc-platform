import assert from "node:assert/strict";
import test from "node:test";
import { CacheService } from "../src/cache/cache.service";

test("cache remember returns cached value without reloading", async () => {
  const cache = new CacheService();
  let calls = 0;

  const first = await cache.remember("meta:tables", () => {
    calls += 1;
    return [{ id: "orders" }];
  });
  const second = await cache.remember("meta:tables", () => {
    calls += 1;
    return [{ id: "customers" }];
  });

  assert.equal(calls, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.deepEqual(second.value, [{ id: "orders" }]);
});

test("cache clear removes remembered values", async () => {
  const cache = new CacheService();
  await cache.remember("meta:tables", () => [{ id: "orders" }]);
  cache.clear();

  assert.equal(cache.get("meta:tables"), undefined);
});
