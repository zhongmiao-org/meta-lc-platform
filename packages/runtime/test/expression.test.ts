import test from "node:test";
import assert from "node:assert/strict";
import {
  ExpressionResolverError,
  getExpressionPathValue,
  resolveExpression,
  resolveExpressionString
} from "./runtime-test-api";

test("resolveExpressionString resolves simple and nested paths", () => {
  const state = {
    user: {
      id: "user-1"
    },
    input: {
      order: {
        user: {
          id: "order-user-1"
        }
      }
    }
  };

  assert.equal(resolveExpressionString("{{user.id}}", state), "user-1");
  assert.equal(resolveExpressionString("{{input.order.user.id}}", state), "order-user-1");
});

test("resolveExpressionString preserves whole-expression value types", () => {
  const profile = {
    id: "user-1",
    name: "Ada"
  };
  const state = {
    user: {
      age: 36,
      profile,
      deletedAt: null
    }
  };

  assert.equal(resolveExpressionString("{{user.age}}", state), 36);
  assert.deepEqual(resolveExpressionString("{{user.profile}}", state), profile);
  assert.equal(resolveExpressionString("{{user.deletedAt}}", state), null);
});

test("resolveExpression recursively maps objects without mutating input", () => {
  const expression = {
    userId: "{{user.id}}",
    label: "hello {{user.name}}",
    nested: {
      age: "{{user.age}}"
    }
  };
  const snapshot = structuredClone(expression);

  const resolved = resolveExpression(expression, {
    user: {
      id: "user-1",
      name: "Ada",
      age: 36
    }
  });

  assert.deepEqual(resolved, {
    userId: "user-1",
    label: "hello Ada",
    nested: {
      age: 36
    }
  });
  assert.deepEqual(expression, snapshot);
});

test("resolveExpression recursively maps arrays without mutating input", () => {
  const expression = ["{{user.id}}", "hello {{user.name}}", { age: "{{user.age}}" }];
  const snapshot = structuredClone(expression);

  const resolved = resolveExpression(expression, {
    user: {
      id: "user-1",
      name: "Ada",
      age: 36
    }
  });

  assert.deepEqual(resolved, ["user-1", "hello Ada", { age: 36 }]);
  assert.deepEqual(expression, snapshot);
});

test("resolveExpression handles missing values explicitly", () => {
  assert.equal(resolveExpressionString("{{user.missing}}", { user: {} }), undefined);
  assert.equal(resolveExpressionString("hello {{user.missing}}", { user: {} }), "hello ");
  assert.deepEqual(resolveExpression({ value: "{{user.missing}}" }, { user: {} }), { value: undefined });
});

test("resolveExpression returns non-expression values unchanged", () => {
  assert.equal(resolveExpression(1, {}), 1);
  assert.equal(resolveExpression(true, {}), true);
  assert.equal(resolveExpression(null, {}), null);
});

test("getExpressionPathValue supports Map and get(path) state sources", () => {
  const mapState = new Map<string, unknown>([
    ["user.id", "map-user-1"],
    ["user", { name: "Ada" }]
  ]);
  const storeState = {
    get(path: string): unknown {
      return path === "user.id" ? "store-user-1" : undefined;
    }
  };

  assert.equal(getExpressionPathValue("user.id", mapState), "map-user-1");
  assert.equal(getExpressionPathValue("user.name", mapState), "Ada");
  assert.equal(resolveExpressionString("{{user.id}}", storeState), "store-user-1");
});

test("getExpressionPathValue rejects invalid state sources", () => {
  assert.throws(
    () => getExpressionPathValue("user.id", undefined as never),
    (error: unknown) => {
      assert.ok(error instanceof ExpressionResolverError);
      assert.equal(error.message, "Expression state source must be an object, Map, or get(path) store.");
      return true;
    }
  );

  assert.throws(
    () => getExpressionPathValue("", {}),
    (error: unknown) => {
      assert.ok(error instanceof ExpressionResolverError);
      assert.equal(error.message, "Expression path is required.");
      return true;
    }
  );
});
