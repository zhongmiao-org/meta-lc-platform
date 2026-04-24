import test from "node:test";
import assert from "node:assert/strict";
import type { QueryRequest } from "@zhongmiao/meta-lc-query";
import { createQueryCompilerAdapter, executeQueryNode, QueryExecutorError, type QueryNodeDefinition, type RuntimeContext, type RuntimeStateStore } from "../src";

const runtimeState: RuntimeStateStore = {
  get(path: string): unknown {
    if (path === "user.id") {
      return "user-1";
    }
    return undefined;
  }
};

const runtimeContext: RuntimeContext = {
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
  const executeCalls: Array<{ kind: string; sql: string; params: unknown[] }> = [];

  const rows = [{ id: "row-1", owner: "user-1" }];
  const result = await executeQueryNode(createQueryNode(), runtimeState, runtimeContext, {
    compiler: {
      compile(request) {
        compileCalls.push(request);
        return {
          sql: 'SELECT "id", "owner" FROM "users" WHERE "owner" = $1 AND "status" = $2 LIMIT 7',
          params: ["user-1", "active"]
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
      sql: 'SELECT "id", "owner" FROM "users" WHERE "owner" = $1 AND "status" = $2 LIMIT 7',
      params: ["user-1", "active"]
    }
  ]);
  assert.deepEqual(result, rows);
});

test("executeQueryNode wraps query compilation errors with traceable stage information", async () => {
  await assert.rejects(
    () =>
      executeQueryNode(createQueryNode(), runtimeState, runtimeContext, {
        compiler: {
          compile() {
            throw new Error("invalid query request");
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
