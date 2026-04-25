import type { DataScopeType } from "@zhongmiao/meta-lc-permission";
import type { ViewDefinition } from "@zhongmiao/meta-lc-runtime";

export interface DatasourceDefinition {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  description?: string;
}

export interface PermissionPolicy {
  id: string;
  resource: string;
  action: string;
  roles: string[];
  scope?: DataScopeType;
}

export type Primitive = string | number | boolean | null;

export interface MetaField {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: Primitive;
}

export interface MetaIndex {
  name: string;
  fields: string[];
  unique?: boolean;
}

export interface MetaTable {
  name: string;
  fields: MetaField[];
  indexes?: MetaIndex[];
}

export interface MetaSchema {
  tables: MetaTable[];
  relations?: SnapshotRelation[];
  tenants?: MetaTenant[];
  apps?: MetaApp[];
  rules?: MetaRule[];
  permissions?: SnapshotPermission[];
}

export interface MetaTenant {
  id: string;
  name: string;
  status?: "active" | "disabled";
}

export interface MetaApp {
  id: string;
  tenantId: string;
  name: string;
  status?: "active" | "disabled";
}

export interface MetaRule {
  id: string;
  appId: string;
  name?: string;
  trigger: string;
}

export interface SnapshotRelation {
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
}

export interface SnapshotPermission {
  resource: string;
  action: string;
  roles: string[];
}

export interface SnapshotV1 {
  version: string;
  tables: MetaTable[];
  relations: SnapshotRelation[];
  permissions: SnapshotPermission[];
  checksum: string;
}

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

export interface MigrationDslV1 {
  version: string;
  actions: MigrationAction[];
  checksum: string;
}

export interface CompiledMigrationSql {
  up: string[];
  down: string[];
}

export interface CompiledSchemaSql {
  tables: string[];
  indexes: string[];
  relations: string[];
  statements: string[];
}

export type ApiRouteOperation = "query" | "mutation";
export type ApiRouteMethod = "POST";

export interface CompiledApiRouteTarget {
  method: ApiRouteMethod;
  path: "/query" | "/mutation";
}

export interface CompiledApiRoute {
  id: string;
  table: string;
  operation: ApiRouteOperation;
  method: ApiRouteMethod;
  path: string;
  target: CompiledApiRouteTarget;
  requestContract: "QueryApiRequest" | "MutationApiRequest";
  responseContract: "QueryApiResponse" | "MutationApiResponse";
}

export interface CompiledApiRouteManifest {
  source: "meta-schema";
  routes: CompiledApiRoute[];
}

export type PermissionRuleEffect = "allow";
export type PermissionRuleEnforcement = "rbac";

export interface CompiledPermissionRule {
  id: string;
  resource: string;
  action: string;
  roles: string[];
  effect: PermissionRuleEffect;
  enforcement: PermissionRuleEnforcement;
}

export interface CompiledPermissionManifest {
  source: "snapshot-permissions";
  rules: CompiledPermissionRule[];
}

export interface MetaVersionMetadata {
  author: string;
  message: string;
  createdAt: string;
  rollbackFromVersion: number | null;
}

export interface MetaVersion {
  appId: string;
  version: number;
  schema: MetaSchema;
  metadata: MetaVersionMetadata;
}

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface MigrationAuditContext {
  requestId?: string;
}

export interface MigrationExecutionOptions {
  allowDestructive?: boolean;
  destructiveStatementAllowlist?: string[];
  requestId?: string;
}

export interface MigrationAuditRecord {
  appId: string;
  fromVersion: number;
  toVersion: number;
  statement: string;
  status: "success" | "failure" | "blocked";
  errorMessage: string | null;
  durationMs: number;
  requestId: string;
}

export type MetaDefinitionKind = "view" | "datasource" | "permissionPolicy";

export interface MetaDefinitionByKind {
  view: ViewDefinition;
  datasource: DatasourceDefinition;
  permissionPolicy: PermissionPolicy;
}

export interface MetaDefinitionVersionMetadata {
  author: string;
  message: string;
  createdAt: string;
}

export interface MetaDefinitionVersion<K extends MetaDefinitionKind = MetaDefinitionKind> {
  appId: string;
  kind: K;
  id: string;
  version: number;
  definition: MetaDefinitionByKind[K];
  metadata: MetaDefinitionVersionMetadata;
}

export interface MetaDefinitionPublishInput<K extends MetaDefinitionKind = MetaDefinitionKind> {
  appId: string;
  kind: K;
  id: string;
  definition: MetaDefinitionByKind[K];
  metadata: {
    author: string;
    message: string;
  };
}

export interface MetaDefinitionDiff {
  appId: string;
  kind: MetaDefinitionKind;
  id: string;
  fromVersion: number;
  toVersion: number;
  changedPaths: string[];
}

export type LatestMetaDefinitionVersion<K extends MetaDefinitionKind = MetaDefinitionKind> =
  MetaDefinitionVersion<K>;

export type { ViewDefinition } from "@zhongmiao/meta-lc-runtime";
