import test from "node:test";
import assert from "node:assert/strict";
import {
  compileViewDefinition,
  type ExecutionPlan,
  ViewCompilerError
} from "../src";
import type { ViewDefinition } from "@zhongmiao/meta-lc-kernel";

test("compileViewDefinition compiles a single query node into a stable plan", () => {
  const plan = compileViewDefinition({
    name: "orders",
    nodes: {
      orders: {
        type: "query",
        table: "orders",
        params: {
          tenantId: "{{input.tenantId}}"
        }
      }
    },
    output: {
      rows: "{{orders.rows}}"
    }
  });

  assert.deepEqual(plan, {
    nodes: [
      {
        id: "orders",
        type: "query",
        definition: {
          type: "query",
          table: "orders",
          params: {
            tenantId: "{{input.tenantId}}"
          }
        }
      }
    ],
    edges: {
      orders: []
    },
    output: {
      rows: "{{orders.rows}}"
    }
  });
});

test("compileViewDefinition keeps multiple root nodes in stable order", () => {
  const view: ViewDefinition = {
    name: "dashboard",
    nodes: {
      zeta: {
        type: "query",
        table: "zeta"
      },
      alpha: {
        type: "query",
        table: "alpha"
      }
    },
    output: {
      alpha: "{{alpha.rows}}",
      zeta: "{{zeta.rows}}"
    }
  };

  assert.deepEqual(compileViewDefinition(view), compileViewDefinition(view));
  assert.deepEqual(
    compileViewDefinition(view).nodes.map((node) => node.id),
    ["alpha", "zeta"]
  );
  assert.deepEqual(compileViewDefinition(view).edges, {
    alpha: [],
    zeta: []
  });
});

test("compileViewDefinition extracts query dependencies from expressions", () => {
  const plan = compileViewDefinition({
    name: "order-detail",
    nodes: {
      user: {
        type: "query",
        table: "users",
        params: {
          userId: "{{input.userId}}"
        }
      },
      orders: {
        type: "query",
        table: "orders",
        params: {
          userId: "{{user.id}}"
        }
      }
    },
    output: {
      rows: "{{orders.rows}}"
    }
  });

  assert.deepEqual(plan.edges, {
    orders: ["user"],
    user: []
  });
});

test("compileViewDefinition supports merge fan-in dependencies", () => {
  const plan = compileViewDefinition({
    name: "account-summary",
    nodes: {
      org: {
        type: "query",
        table: "orgs",
        params: {
          orgId: "{{input.orgId}}"
        }
      },
      user: {
        type: "query",
        table: "users",
        params: {
          userId: "{{input.userId}}"
        }
      },
      summary: {
        type: "merge",
        strategy: "objectMerge",
        inputs: {
          org: "{{org.row}}",
          user: "{{user.row}}"
        }
      }
    },
    output: {
      summary: "{{summary.value}}"
    }
  });

  assert.deepEqual(plan.edges, {
    org: [],
    summary: ["org", "user"],
    user: []
  });
});

test("compileViewDefinition preserves mutation and submit contracts", () => {
  const plan = compileViewDefinition({
    name: "save-order",
    nodes: {
      save: {
        type: "mutation",
        model: "orders",
        payload: {
          status: "{{input.status}}"
        }
      },
      refresh: {
        type: "query",
        table: "orders",
        params: {
          orderId: "{{save.row.id}}"
        }
      }
    },
    output: {
      row: "{{refresh.row}}"
    },
    submit: {
      nodes: ["save", "refresh"]
    }
  });

  assert.deepEqual(plan.edges, {
    refresh: ["save"],
    save: []
  });
  assert.deepEqual(plan.submit, {
    nodes: ["save", "refresh"]
  });
});

test("compileViewDefinition rejects unknown node dependencies with a clear error", () => {
  assert.throws(
    () =>
      compileViewDefinition({
        name: "broken-view",
        nodes: {
          orders: {
            type: "query",
            table: "orders",
            params: {
              userId: "{{missingUser.id}}"
            }
          }
        },
        output: {
          rows: "{{orders.rows}}"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof ViewCompilerError);
      assert.equal(
        error.message,
        'Unknown node dependency "missingUser" referenced by expression "{{missingUser.id}}" at nodes.orders.'
      );
      return true;
    }
  );

  assert.throws(
    () =>
      compileViewDefinition({
        name: "broken-output",
        nodes: {
          orders: {
            type: "query",
            table: "orders"
          }
        },
        output: {
          rows: "{{missingOrders.rows}}"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof ViewCompilerError);
      assert.equal(
        error.message,
        'Unknown node dependency "missingOrders" referenced by expression "{{missingOrders.rows}}" at output.'
      );
      return true;
    }
  );

  assert.throws(
    () =>
      compileViewDefinition({
        name: "broken-submit",
        nodes: {
          save: {
            type: "mutation"
          }
        },
        output: {
          row: "{{save.row}}"
        },
        submit: {
          nodes: ["missingSave"]
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof ViewCompilerError);
      assert.equal(error.message, 'SubmitDefinition references unknown node "missingSave".');
      return true;
    }
  );
});

test("compileViewDefinition leaves cycle detection to the downstream scheduler", () => {
  const plan = compileViewDefinition({
    name: "cycle-fixture",
    nodes: {
      first: {
        type: "transform",
        value: "{{second.value}}"
      },
      second: {
        type: "transform",
        value: "{{first.value}}"
      }
    },
    output: {
      value: "{{first.value}}"
    }
  });

  assert.deepEqual(plan.edges, {
    first: ["second"],
    second: ["first"]
  });
  assertPlanHasOnlyCompilerShape(plan);
});

function assertPlanHasOnlyCompilerShape(plan: ExecutionPlan): void {
  assert.equal(typeof plan, "object");
  assert.ok(Array.isArray(plan.nodes));
  assert.equal(typeof plan.edges, "object");
  assert.equal(typeof plan.output, "object");
}
