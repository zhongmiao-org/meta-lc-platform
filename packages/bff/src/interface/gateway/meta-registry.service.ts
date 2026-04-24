import { Injectable } from "@nestjs/common";
import type { ViewDefinition } from "@zhongmiao/meta-lc-runtime";

export type MetaResourceKind = "tables" | "pages" | "datasources" | "rules" | "permissions";

export interface MetaRegistryItem {
  id: string;
  name: string;
  updatedAt: string;
  [key: string]: unknown;
}

const UPDATED_AT = "2026-04-20T00:00:00.000Z";
const VIEW_FIXTURES: Record<string, ViewDefinition> = {
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

const FIXTURES: Record<MetaResourceKind, MetaRegistryItem[]> = {
  tables: [
    {
      id: "orders",
      name: "Orders",
      updatedAt: UPDATED_AT,
      fields: ["id", "owner", "channel", "priority", "status", "tenant_id", "org_id"]
    }
  ],
  pages: [
    {
      id: "orders-workbench",
      name: "Orders Workbench",
      updatedAt: UPDATED_AT,
      route: "/studio/page/orders"
    }
  ],
  datasources: [
    {
      id: "orders-query",
      name: "Orders Query",
      updatedAt: UPDATED_AT,
      type: "bff-query"
    }
  ],
  rules: [
    {
      id: "orders-refresh-after-mutation",
      name: "Refresh Orders After Mutation",
      updatedAt: UPDATED_AT,
      trigger: "mutation.succeeded"
    }
  ],
  permissions: [
    {
      id: "orders-data-scope",
      name: "Orders Data Scope",
      updatedAt: UPDATED_AT,
      scopes: ["SELF", "DEPT", "DEPT_AND_CHILDREN", "CUSTOM_ORG_SET", "TENANT_ALL"]
    }
  ]
};

@Injectable()
export class MetaRegistryService {
  list(kind: MetaResourceKind): MetaRegistryItem[] {
    return FIXTURES[kind].map((item) => ({ ...item }));
  }

  listKinds(): MetaResourceKind[] {
    return ["tables", "pages", "datasources", "rules", "permissions"];
  }

  getView(name: string): ViewDefinition | null {
    const view = VIEW_FIXTURES[name];
    return view ? structuredClone(view) : null;
  }

  listViewNames(): string[] {
    return Object.keys(VIEW_FIXTURES).sort((left, right) => left.localeCompare(right));
  }
}
