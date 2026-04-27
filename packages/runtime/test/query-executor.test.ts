import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSelectQueryAst,
  compileSelectAst,
  type QueryRequest,
  type SelectQueryAst
} from "@zhongmiao/meta-lc-query";
import type { QueryNodeDefinition } from "@zhongmiao/meta-lc-kernel";
import { executeQueryNode, QueryExecutorError, type RuntimeContext, type RuntimeStateStore } from "../src";
import { createQueryCompilerAdapter } from "../src/infra/adapters/query.adapter";
import type { RuntimeAuditEvent } from "../src";

const runtimeState: RuntimeStateStore = {
  get(path: string): unknown {
    if (path === "user.id") {
      return "user-1";
    }
    return undefined;
  }
};

const runtimeContext: RuntimeContext = {
  tenantId: "tenant-a",
  userId: "user-1",
  roles: ["USER"],
  params: {
    limit: 7
  }
};

function createQueryNode(): QueryNodeDefinition {
  return {
    type: "query",
    table: "users",
    fields: ["id", "owner"],
    filters: {
      owner: "{{user.id}}",
      status: "active"
    },
    limit: "{{params.limit}}"
  };
}

test("executeQueryNode resolves expressions before compiling and querying", async () => {
  const compileCalls: QueryRequest[] = [];
  const permissionCalls: Array<{ ast: SelectQueryAst; tenantId: string }> = [];
  const compileAstCalls: SelectQueryAst[] = [];
  const executeCalls: Array<{ kind: string; sql: string; params: unknown[] }> = [];

  const rows = [{ id: "row-1", owner: "user-1" }];
  const result = await executeQueryNode(createQueryNode(), runtimeState, runtimeContext, {
    compiler: {
      buildAst(request) {
        compileCalls.push(request);
        return buildSelectQueryAst(request);
      },
      compileAst(ast) {
        compileAstCalls.push(ast);
        return compileSelectAst(ast);
      },
      compile() {
        throw new Error("legacy compile should not be called");
      }
    },
    permission: {
      transform(ast, context) {
        permissionCalls.push({ ast, tenantId: context.tenantId });
        return {
          ...ast,
          where: {
            type: "logical",
            operator: "and",
            predicates: [
              ...(ast.where ? [ast.where] : []),
              {
                type: "comparison",
                left: { name: "tenant_id" },
                operator: "eq",
                value: context.tenantId
              }
            ]
          }
        };
      }
    },
    datasource: {
      async execute(request) {
        executeCalls.push({
          kind: request.kind,
          sql: request.sql,
          params: request.params ?? []
        });
        return {
          rows,
          rowCount: rows.length,
          metadata: {
            kind: request.kind,
            durationMs: 1
          }
        };
      }
    }
  });

  assert.deepEqual(compileCalls, [
    {
      table: "users",
      fields: ["id", "owner"],
      filters: {
        owner: "user-1",
        status: "active"
      },
      limit: 7
    }
  ]);
  assert.deepEqual(executeCalls, [
    {
      kind: "query",
      sql: 'SELECT "id", "owner" FROM "users" WHERE ("owner" = $1 AND "status" = $2) AND "tenant_id" = $3 LIMIT 7',
      params: ["user-1", "active", "tenant-a"]
    }
  ]);
  assert.equal(permissionCalls.length, 1);
  assert.equal(permissionCalls[0]?.tenantId, "tenant-a");
  assert.equal(compileAstCalls.length, 1);
  assert.deepEqual(result, rows);
});

test("executeQueryNode emits permission and datasource observability events", async () => {
  const events: RuntimeAuditEvent[] = [];
  const rows = [{ id: "row-1", owner: "user-1" }];

  const result = await executeQueryNode(createQueryNode(), runtimeState, {
    ...runtimeContext,
    requestId: "req-query-1",
    planId: "plan-query-1",
    viewName: "orders-workbench"
  }, {
    compiler: createQueryCompilerAdapter(),
    datasource: {
      async execute(request) {
        return {
          rows,
          rowCount: rows.length,
          metadata: {
            kind: request.kind,
            durationMs: 3
          }
        };
      }
    },
    audit: {
      observer: {
        recordRuntimeEvent(event) {
          events.push(event);
        }
      },
      nodeId: "orders",
      nodeType: "query"
    }
  });

  assert.deepEqual(result, rows);
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "runtime.permission.decision",
      "runtime.datasource.succeeded"
    ]
  );
  assert.equal(events[0]?.requestId, "req-query-1");
  assert.equal(events[0]?.planId, "plan-query-1");
  assert.equal(events[0]?.nodeId, "orders");
  assert.equal(events[0]?.status, "allow");
  assert.equal(events[1]?.status, "success");
  assert.equal(events[1]?.metadata?.rowCount, 1);
});

test("executeQueryNode emits datasource failure events while preserving execute errors", async () => {
  const events: RuntimeAuditEvent[] = [];

  await assert.rejects(
    () =>
      executeQueryNode(createQueryNode(), runtimeState, {
        ...runtimeContext,
        requestId: "req-query-2"
      }, {
        compiler: createQueryCompilerAdapter(),
        datasource: {
          async execute() {
            throw new Error("database offline");
          }
        },
        audit: {
          observer: {
            recordRuntimeEvent(event) {
              events.push(event);
            }
          },
          nodeId: "orders",
          nodeType: "query"
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof QueryExecutorError);
      assert.equal(error.stage, "execute");
      return true;
    }
  );

  assert.deepEqual(
    events.map((event) => event.type),
    [
      "runtime.permission.decision",
      "runtime.datasource.failed"
    ]
  );
  assert.equal(events[1]?.requestId, "req-query-2");
  assert.equal(events[1]?.planId, "req-query-2");
  assert.equal(events[1]?.nodeId, "orders");
  assert.match(events[1]?.errorMessage ?? "", /database offline/);
});

test("executeQueryNode wraps query compilation errors with traceable stage information", async () => {
  await assert.rejects(
    () =>
      executeQueryNode(createQueryNode(), runtimeState, runtimeContext, {
        compiler: {
          buildAst() {
            throw new Error("invalid query request");
          },
          compileAst() {
            throw new Error("should not compile ast");
          },
          compile() {
            throw new Error("legacy compile should not be called");
          }
        },
        datasource: {
          async execute() {
            throw new Error("should not be called");
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof QueryExecutorError);
      assert.equal(error.stage, "compile");
      assert.equal(error.cause instanceof Error, true);
      assert.match(error.message, /Failed to compile query node/);
      assert.match(error.message, /invalid query request/);
      return true;
    }
  );
});

test("executeQueryNode wraps permission transform errors as compile errors", async () => {
  await assert.rejects(
    () =>
      executeQueryNode(createQueryNode(), runtimeState, runtimeContext, {
        compiler: createQueryCompilerAdapter(),
        permission: {
          transform() {
            throw new Error("permission transform failed");
          }
        },
        datasource: {
          async execute() {
            throw new Error("should not be called");
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof QueryExecutorError);
      assert.equal(error.stage, "compile");
      assert.match(error.message, /permission transform failed/);
      return true;
    }
  );
});

test("executeQueryNode wraps datasource errors as node errors", async () => {
  await assert.rejects(
    () =>
      executeQueryNode(createQueryNode(), runtimeState, runtimeContext, {
        compiler: createQueryCompilerAdapter(),
        datasource: {
          async execute() {
            throw new Error("database offline");
          }
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof QueryExecutorError);
      assert.equal(error.stage, "execute");
      assert.equal(error.cause instanceof Error, true);
      assert.match(error.message, /Failed to execute query node/);
      assert.match(error.message, /database offline/);
      return true;
    }
  );
});

test("executeQueryNode returns empty results unchanged", async () => {
  const rows = await executeQueryNode(createQueryNode(), runtimeState, runtimeContext, {
    compiler: createQueryCompilerAdapter(),
    datasource: {
      async execute(request) {
        return {
          rows: [],
          rowCount: 0,
          metadata: {
            kind: request.kind,
            durationMs: 1
          }
        };
      }
    }
  });

  assert.deepEqual(rows, []);
});
