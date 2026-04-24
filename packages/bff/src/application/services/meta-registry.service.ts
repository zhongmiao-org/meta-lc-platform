import { Injectable } from "@nestjs/common";
import type { ViewDefinition } from "@zhongmiao/meta-lc-runtime";
import { META_REGISTRY_UPDATED_AT, META_REGISTRY_VIEW_FIXTURES } from "../../constants/meta-registry.constants";
import type {
  MetaRegistryItem,
  MetaResourceKind
} from "../../contracts/types/meta-registry.type";

const FIXTURES: Record<MetaResourceKind, MetaRegistryItem[]> = {
  tables: [
    {
      id: "orders",
      name: "Orders",
      updatedAt: META_REGISTRY_UPDATED_AT,
      fields: ["id", "owner", "channel", "priority", "status", "tenant_id", "org_id"]
    }
  ],
  pages: [
    {
      id: "orders-workbench",
      name: "Orders Workbench",
      updatedAt: META_REGISTRY_UPDATED_AT,
      route: "/studio/page/orders"
    }
  ],
  datasources: [
    {
      id: "orders-query",
      name: "Orders Query",
      updatedAt: META_REGISTRY_UPDATED_AT,
      type: "bff-query"
    }
  ],
  rules: [
    {
      id: "orders-refresh-after-mutation",
      name: "Refresh Orders After Mutation",
      updatedAt: META_REGISTRY_UPDATED_AT,
      trigger: "mutation.succeeded"
    }
  ],
  permissions: [
    {
      id: "orders-data-scope",
      name: "Orders Data Scope",
      updatedAt: META_REGISTRY_UPDATED_AT,
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
    const view = META_REGISTRY_VIEW_FIXTURES[name];
    return view ? structuredClone(view) : null;
  }

  listViewNames(): string[] {
    return Object.keys(META_REGISTRY_VIEW_FIXTURES).sort((left, right) => left.localeCompare(right));
  }
}
