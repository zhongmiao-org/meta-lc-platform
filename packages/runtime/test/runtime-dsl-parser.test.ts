import test from "node:test";
import assert from "node:assert/strict";
import type { RuntimePageDsl } from "@zhongmiao/meta-lc-contracts";
import { parseRuntimePageDsl, RuntimeDslParseError } from "../src";

function createRuntimeDsl(): RuntimePageDsl {
  return {
    schemaVersion: "runtime-page-dsl.v1",
    pageMeta: {
      id: "orders-crud-page",
      title: "Orders CRUD"
    },
    state: {
      tenantId: "tenant-a",
      userId: "demo-tenant-a-user",
      roles: ["USER"],
      filter_status: "PAID",
      tableData: []
    },
    datasources: [
      {
        id: "orders-query-datasource",
        type: "rest",
        request: {
          method: "POST",
          url: "/query",
          params: {
            table: "orders",
            tenantId: "{{state.tenantId}}",
            status: "{{state.filter_status}}"
          }
        },
        responseMapping: {
          stateKey: "tableData"
        }
      }
    ],
    actions: [
      {
        id: "search-action",
        steps: [
          {
            type: "callDatasource",
            datasourceId: "orders-query-datasource",
            stateKey: "tableData",
            payloadTemplate: {
              tenantId: "{{state.tenantId}}"
            }
          }
        ]
      }
    ],
    layoutTree: [
      {
        id: "page-root",
        componentType: "page",
        props: {
          title: "{{state.tenantId}} Orders"
        },
        children: [
          {
            id: "results-table",
            componentType: "table",
            props: {
              dataKey: "tableData"
            }
          }
        ]
      }
    ]
  };
}

test("parseRuntimePageDsl parses the minimal runtime dsl and collects dependencies", () => {
  const parsed = parseRuntimePageDsl(createRuntimeDsl());

  assert.equal(parsed.datasources[0]?.id, "orders-query-datasource");
  assert.deepEqual(parsed.dependencies.datasources["orders-query-datasource"], [
    {
      source: "state",
      key: "tenantId",
      expression: "{{state.tenantId}}"
    },
    {
      source: "state",
      key: "filter_status",
      expression: "{{state.filter_status}}"
    }
  ]);
  assert.deepEqual(parsed.dependencies.actions["search-action"], [
    {
      source: "state",
      key: "tenantId",
      expression: "{{state.tenantId}}"
    }
  ]);
  assert.deepEqual(parsed.dependencies.layoutNodes["page-root"], [
    {
      source: "state",
      key: "tenantId",
      expression: "{{state.tenantId}}"
    }
  ]);
});

test("parseRuntimePageDsl throws a stable parse error for missing required fields", () => {
  assert.throws(
    () =>
      parseRuntimePageDsl({
        ...createRuntimeDsl(),
        pageMeta: {
          id: "",
          title: ""
        },
        actions: [{ id: "search-action", steps: [] }]
      }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDslParseError);
      const parseError = error as RuntimeDslParseError;
      assert.deepEqual(parseError.issues, [
        {
          path: "pageMeta.id",
          message: "is required."
        },
        {
          path: "pageMeta.title",
          message: "is required."
        },
        {
          path: "actions[0].steps",
          message: "must contain at least one step."
        }
      ]);
      return true;
    }
  );
});
