import {
  InMemoryMetaKernelRepository,
  MetaKernelService,
  type DatasourceDefinition,
  type MetaDefinitionKind,
  type MetaDefinitionVersion,
  type PermissionPolicy,
  type ViewDefinition
} from "../../packages/kernel/dist/src/index.js";
import type {
  MetaRegistryItem,
  MetaRegistryProvider,
  MetaResourceKind
} from "@zhongmiao/meta-lc-bff";

type DemoMetaDefinitionSeed<K extends MetaDefinitionKind = MetaDefinitionKind> = {
  appId: string;
  kind: K;
  id: string;
  definition: MetaDefinitionVersion<K>["definition"];
  metadata: Partial<MetaDefinitionVersion<K>["metadata"]>;
};

export const ORDERS_DEMO_UPDATED_AT = "2026-04-20T00:00:00.000Z";
export const ORDERS_DEMO_APP_ID = "orders-demo-app";

export const ORDERS_DEMO_VIEW_FIXTURES: Record<string, ViewDefinition> = {
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

export const ORDERS_DEMO_DATASOURCE_FIXTURES: Record<string, DatasourceDefinition> = {
  "orders-query": {
    id: "orders-query",
    type: "runtime-query",
    description: "Orders runtime query datasource"
  }
};

export const ORDERS_DEMO_PERMISSION_FIXTURES: Record<string, PermissionPolicy> = {
  "orders-data-scope": {
    id: "orders-data-scope",
    resource: "orders",
    action: "query",
    roles: ["SELF", "DEPT", "DEPT_AND_CHILDREN", "CUSTOM_ORG_SET", "TENANT_ALL"]
  }
};

export const ORDERS_DEMO_DEFINITION_SEEDS: DemoMetaDefinitionSeed[] = [
  ...Object.entries(ORDERS_DEMO_VIEW_FIXTURES).map(([id, definition]) => ({
    appId: ORDERS_DEMO_APP_ID,
    kind: "view" as const,
    id,
    definition,
    metadata: {
      author: "orders-demo",
      message: "Seed orders demo view definition",
      createdAt: ORDERS_DEMO_UPDATED_AT
    }
  })),
  ...Object.entries(ORDERS_DEMO_DATASOURCE_FIXTURES).map(([id, definition]) => ({
    appId: ORDERS_DEMO_APP_ID,
    kind: "datasource" as const,
    id,
    definition,
    metadata: {
      author: "orders-demo",
      message: "Seed orders demo datasource definition",
      createdAt: ORDERS_DEMO_UPDATED_AT
    }
  })),
  ...Object.entries(ORDERS_DEMO_PERMISSION_FIXTURES).map(([id, definition]) => ({
    appId: ORDERS_DEMO_APP_ID,
    kind: "permissionPolicy" as const,
    id,
    definition,
    metadata: {
      author: "orders-demo",
      message: "Seed orders demo permission policy",
      createdAt: ORDERS_DEMO_UPDATED_AT
    }
  }))
];

const STATIC_FIXTURES: Pick<Record<MetaResourceKind, MetaRegistryItem[]>, "tables" | "rules"> = {
  tables: [
    {
      id: "orders",
      name: "Orders",
      updatedAt: ORDERS_DEMO_UPDATED_AT,
      fields: ["id", "owner", "channel", "priority", "status", "tenant_id", "org_id"]
    }
  ],
  rules: [
    {
      id: "orders-refresh-after-mutation",
      name: "Refresh Orders After Mutation",
      updatedAt: ORDERS_DEMO_UPDATED_AT,
      trigger: "mutation.succeeded"
    }
  ]
};

export function createOrdersDemoMetaKernel(): MetaKernelService {
  return new MetaKernelService(
    new InMemoryMetaKernelRepository({
      definitions: ORDERS_DEMO_DEFINITION_SEEDS
    })
  );
}

export function createOrdersDemoMetaRegistryProvider(): MetaRegistryProvider {
  const kernel = createOrdersDemoMetaKernel();
  return {
    async list(kind) {
      if (kind === "pages") return listKernelDefinitions(kernel, "view");
      if (kind === "datasources") return listKernelDefinitions(kernel, "datasource");
      if (kind === "permissions") return listKernelDefinitions(kernel, "permissionPolicy");
      return STATIC_FIXTURES[kind].map((item) => ({ ...item }));
    },
    listKinds() {
      return ["tables", "pages", "datasources", "rules", "permissions"];
    }
  };
}

async function listKernelDefinitions(
  kernel: MetaKernelService,
  kind: MetaDefinitionKind
): Promise<MetaRegistryItem[]> {
  const definitions = await kernel.listLatestDefinitions(ORDERS_DEMO_APP_ID, kind);
  return definitions.map((item) => toMetaRegistryItem(item));
}

function toMetaRegistryItem(item: MetaDefinitionVersion): MetaRegistryItem {
  if (item.kind === "view") {
    const definition = item.definition as ViewDefinition;
    return {
      id: item.id,
      name: definition.name,
      updatedAt: item.metadata.createdAt,
      version: item.version
    };
  }
  if (item.kind === "datasource") {
    const definition = item.definition as DatasourceDefinition;
    return {
      id: item.id,
      name: definition.id,
      updatedAt: item.metadata.createdAt,
      type: definition.type,
      version: item.version
    };
  }
  const definition = item.definition as PermissionPolicy;
  return {
    id: item.id,
    name: definition.id,
    updatedAt: item.metadata.createdAt,
    resource: definition.resource,
    action: definition.action,
    roles: [...definition.roles],
    version: item.version
  };
}
