import test from "node:test";
import assert from "node:assert/strict";
import { createFunctionRegistry, RuntimeFunctionRegistryError } from "../src";

test("createFunctionRegistry registers and executes built-in functions", async () => {
  const registry = createFunctionRegistry();

  assert.equal(
    await registry.exec("eq", ["PAID", "PAID"], {} as never),
    true
  );
  assert.equal(
    await registry.exec("notEmpty", [["USER"]], {} as never),
    true
  );
  assert.equal(
    await registry.exec("includes", [["USER", "ADMIN"], "ADMIN"], {} as never),
    true
  );
});

test("createFunctionRegistry supports custom handlers and fails on unknown functions", async () => {
  const registry = createFunctionRegistry();
  registry.register("concat", ([left, right]) => `${left}${right}`);

  assert.equal(await registry.exec("concat", ["meta", "-lc"], {} as never), "meta-lc");

  await assert.rejects(
    () => registry.exec("missing", [], {} as never),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeFunctionRegistryError);
      assert.equal(error.message, 'Runtime function "missing" is not registered.');
      return true;
    }
  );
});
