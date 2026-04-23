import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDagDependencyGraph,
  DagSchedulerError,
  detectCycle,
  resolveExecutionOrder,
  topoSort
} from "../src";

test("DAG scheduler handles an empty graph explicitly", () => {
  assert.deepEqual(topoSort({}), []);
  assert.deepEqual(resolveExecutionOrder({}), []);
  assert.equal(detectCycle({}), null);
  assert.deepEqual(buildDagDependencyGraph({}), { nodes: {} });
});

test("DAG scheduler resolves a linear graph", () => {
  const edges = {
    summary: ["orders"],
    orders: ["user"],
    user: []
  };

  assert.deepEqual(topoSort(edges), ["user", "orders", "summary"]);
  assert.deepEqual(resolveExecutionOrder(edges), [["user"], ["orders"], ["summary"]]);
});

test("DAG scheduler resolves diamond fan-out and fan-in layers", () => {
  const edges = {
    merge: ["orders", "org"],
    orders: ["user"],
    org: ["user"],
    user: []
  };

  assert.deepEqual(topoSort(edges), ["user", "orders", "org", "merge"]);
  assert.deepEqual(resolveExecutionOrder(edges), [["user"], ["orders", "org"], ["merge"]]);
});

test("DAG scheduler keeps multiple roots in stable order", () => {
  const edges = {
    zeta: [],
    alpha: [],
    merge: ["zeta", "alpha"]
  };

  assert.deepEqual(topoSort(edges), ["alpha", "zeta", "merge"]);
  assert.deepEqual(resolveExecutionOrder(edges), [["alpha", "zeta"], ["merge"]]);
});

test("DAG scheduler rejects unknown dependencies", () => {
  assert.throws(
    () =>
      topoSort({
        orders: ["missingUser"]
      }),
    (error: unknown) => {
      assert.ok(error instanceof DagSchedulerError);
      assert.equal(error.message, 'Node "orders" depends on unknown node "missingUser".');
      return true;
    }
  );
});

test("DAG scheduler detects cycles and scheduling functions fail clearly", () => {
  const edges = {
    first: ["second"],
    second: ["third"],
    third: ["first"]
  };

  assert.deepEqual(detectCycle(edges), {
    path: ["first", "second", "third", "first"]
  });
  assert.throws(
    () => topoSort(edges),
    (error: unknown) => {
      assert.ok(error instanceof DagSchedulerError);
      assert.equal(error.message, "DAG cycle detected: first -> second -> third -> first.");
      return true;
    }
  );
  assert.throws(
    () => resolveExecutionOrder(edges),
    (error: unknown) => {
      assert.ok(error instanceof DagSchedulerError);
      assert.equal(error.message, "DAG cycle detected: first -> second -> third -> first.");
      return true;
    }
  );
});

test("DAG scheduler output is stable regardless of input key order", () => {
  const left = {
    view: ["profile", "orders"],
    orders: ["user"],
    profile: ["user"],
    user: []
  };
  const right = {
    user: [],
    profile: ["user"],
    orders: ["user"],
    view: ["orders", "profile"]
  };

  assert.deepEqual(topoSort(left), topoSort(right));
  assert.deepEqual(resolveExecutionOrder(left), resolveExecutionOrder(right));
  assert.deepEqual(resolveExecutionOrder(left), [["user"], ["orders", "profile"], ["view"]]);
});
