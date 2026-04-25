import { Injectable } from "@nestjs/common";
import type {
  DatasourceDefinition,
  PermissionPolicy,
  ViewDefinition
} from "@zhongmiao/meta-lc-kernel";
import {
  META_KERNEL_APP_ID,
  META_KERNEL_DEFINITION_SEEDS,
  META_REGISTRY_UPDATED_AT,
  InMemoryMetaKernelRepository,
  MetaKernelService,
  type MetaDefinitionKind,
  type MetaDefinitionVersion
} from "@zhongmiao/meta-lc-kernel";
import type {
  MetaRegistryItem,
  MetaResourceKind
} from "../types/meta-registry.type";

const STATIC_FIXTURES: Pick<Record<MetaResourceKind, MetaRegistryItem[]>, "tables" | "rules"> = {
  tables: [
    {
      id: "orders",
      name: "Orders",
      updatedAt: META_REGISTRY_UPDATED_AT,
      fields: ["id", "owner", "channel", "priority", "status", "tenant_id", "org_id"]
    }
  ],
  rules: [
    {
      id: "orders-refresh-after-mutation",
      name: "Refresh Orders After Mutation",
      updatedAt: META_REGISTRY_UPDATED_AT,
      trigger: "mutation.succeeded"
    }
  ]
};

@Injectable()
export class MetaRegistryService {
  private readonly kernel = new MetaKernelService(
    new InMemoryMetaKernelRepository({
      definitions: META_KERNEL_DEFINITION_SEEDS
    })
  );

  async list(kind: MetaResourceKind): Promise<MetaRegistryItem[]> {
    if (kind === "pages") {
      return this.listKernelDefinitions("view");
    }
    if (kind === "datasources") {
      return this.listKernelDefinitions("datasource");
    }
    if (kind === "permissions") {
      return this.listKernelDefinitions("permissionPolicy");
    }
    return STATIC_FIXTURES[kind].map((item) => ({ ...item }));
  }

  listKinds(): MetaResourceKind[] {
    return ["tables", "pages", "datasources", "rules", "permissions"];
  }

  async getView(name: string): Promise<ViewDefinition | null> {
    const view = await this.kernel.getViewDefinition(META_KERNEL_APP_ID, name);
    return view ? structuredClone(view.definition) : null;
  }

  async listViewNames(): Promise<string[]> {
    const views = await this.kernel.listLatestDefinitions(META_KERNEL_APP_ID, "view");
    return views.map((view) => view.id).sort((left, right) => left.localeCompare(right));
  }

  private async listKernelDefinitions(kind: MetaDefinitionKind): Promise<MetaRegistryItem[]> {
    const definitions = await this.kernel.listLatestDefinitions(META_KERNEL_APP_ID, kind);
    return definitions.map((item) => toMetaRegistryItem(item));
  }
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
