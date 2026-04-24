import type { ViewDefinition } from "@zhongmiao/meta-lc-contracts";

export const META_REGISTRY_UPDATED_AT = "2026-04-20T00:00:00.000Z";

export const META_REGISTRY_VIEW_FIXTURES: Record<string, ViewDefinition> = {
  "orders-workbench": {
    name: "orders-workbench",
    nodes: {
      orders: {
        type: "query",
        table: "orders",
        fields: ["id", "owner", "channel", "priority", "status"],
        filters: {
          tenant_id: "{{context.tenantId}}",
          owner: "{{input.owner}}",
          created_by: "{{context.userId}}"
        },
        limit: "{{input.limit}}"
      }
    },
    output: {
      requestId: "{{context.requestId}}",
      tenantId: "{{context.tenantId}}",
      owner: "{{input.owner}}",
      rows: "{{orders.rows}}"
    }
  }
};
