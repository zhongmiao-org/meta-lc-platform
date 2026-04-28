import type {
  MergeNodeDefinition,
  MetaDefinitionVersion,
  MetaField,
  MetaTable,
  MutationNodeDefinition,
  QueryNodeDefinition,
  TransformNodeDefinition
} from "../interfaces";

export type ViewExpression =
  | string
  | number
  | boolean
  | null
  | ViewExpression[]
  | { [key: string]: ViewExpression };

export type NodeDefinition = QueryNodeDefinition | MutationNodeDefinition | TransformNodeDefinition | MergeNodeDefinition;

export type MergeStrategy = "objectMerge" | "arrayConcat" | "custom";

export type DataScopeType =
  | "SELF"
  | "DEPT"
  | "DEPT_AND_CHILDREN"
  | "CUSTOM_ORG_SET"
  | "TENANT_ALL";

export type Primitive = string | number | boolean | null;

export type MigrationAction =
  | {
      type: "create_table";
      table: MetaTable;
    }
  | {
      type: "drop_table";
      table: MetaTable;
    }
  | {
      type: "add_column";
      table: string;
      column: MetaField;
    }
  | {
      type: "drop_column";
      table: string;
      column: MetaField;
    }
  | {
      type: "alter_column";
      table: string;
      columnName: string;
      fromType: string;
      toType: string;
    };

export type ApiRouteOperation = "query" | "mutation";

export type ApiRouteMethod = "POST";

export type PermissionRuleEffect = "allow";

export type PermissionRuleEnforcement = "rbac";

export type MetaDefinitionKind = "view" | "datasource" | "permissionPolicy";

export type LatestMetaDefinitionVersion<K extends MetaDefinitionKind = MetaDefinitionKind> =
  MetaDefinitionVersion<K>;
