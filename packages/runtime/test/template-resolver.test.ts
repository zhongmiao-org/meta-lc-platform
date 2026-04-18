import test from "node:test";
import assert from "node:assert/strict";
import { collectTemplateDependencies, resolveTemplateString, resolveTemplateValue } from "../src";

test("collectTemplateDependencies extracts state references from nested values", () => {
  const dependencies = collectTemplateDependencies({
    body: {
      tenantId: "{{state.tenantId}}",
      filters: ["{{state.filter_status}}", "{{state.filter_status}}"],
      title: "Orders for {{state.userId}}"
    }
  });

  assert.deepEqual(dependencies, [
    {
      source: "state",
      key: "tenantId",
      expression: "{{state.tenantId}}"
    },
    {
      source: "state",
      key: "filter_status",
      expression: "{{state.filter_status}}"
    },
    {
      source: "state",
      key: "userId",
      expression: "{{state.userId}}"
    }
  ]);
});

test("resolveTemplateValue resolves nested state templates for the current demo chain", () => {
  const resolved = resolveTemplateValue(
    {
      title: "Orders for {{state.tenantId}}",
      payload: {
        tenantId: "{{state.tenantId}}",
        selectedId: "{{state.selectedOrderId}}"
      }
    },
    {
      tenantId: "tenant-a",
      selectedOrderId: "SO-1001"
    }
  );

  assert.deepEqual(resolved, {
    title: "Orders for tenant-a",
    payload: {
      tenantId: "tenant-a",
      selectedId: "SO-1001"
    }
  });
  assert.equal(resolveTemplateString("{{state.missing}}", {}), "");
});
