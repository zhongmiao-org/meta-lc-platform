import type {
  DatasourceDefinition,
  PermissionPolicy,
  ViewDefinition
} from "@zhongmiao/meta-lc-contracts";
import type { InMemoryMetaDefinitionSeed } from "@zhongmiao/meta-lc-kernel";

export const META_REGISTRY_UPDATED_AT = "2026-04-20T00:00:00.000Z";
export const META_KERNEL_APP_ID = "orders-demo-app";

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

export const META_REGISTRY_DATASOURCE_FIXTURES: Record<string, DatasourceDefinition> = {
  "orders-query": {
    id: "orders-query",
    type: "bff-query",
    description: "Orders runtime query datasource"
  }
};

export const META_REGISTRY_PERMISSION_FIXTURES: Record<string, PermissionPolicy> = {
  "orders-data-scope": {
    id: "orders-data-scope",
    resource: "orders",
    action: "query",
    roles: ["SELF", "DEPT", "DEPT_AND_CHILDREN", "CUSTOM_ORG_SET", "TENANT_ALL"]
  }
};

export const META_KERNEL_DEFINITION_SEEDS: InMemoryMetaDefinitionSeed[] = [
  ...Object.entries(META_REGISTRY_VIEW_FIXTURES).map(([id, definition]) => ({
    appId: META_KERNEL_APP_ID,
    kind: "view" as const,
    id,
    definition,
    metadata: {
      author: "system",
      message: "Seed demo view definition",
      createdAt: META_REGISTRY_UPDATED_AT
    }
  })),
  ...Object.entries(META_REGISTRY_DATASOURCE_FIXTURES).map(([id, definition]) => ({
    appId: META_KERNEL_APP_ID,
    kind: "datasource" as const,
    id,
    definition,
    metadata: {
      author: "system",
      message: "Seed demo datasource definition",
      createdAt: META_REGISTRY_UPDATED_AT
    }
  })),
  ...Object.entries(META_REGISTRY_PERMISSION_FIXTURES).map(([id, definition]) => ({
    appId: META_KERNEL_APP_ID,
    kind: "permissionPolicy" as const,
    id,
    definition,
    metadata: {
      author: "system",
      message: "Seed demo permission policy",
      createdAt: META_REGISTRY_UPDATED_AT
    }
  }))
];
