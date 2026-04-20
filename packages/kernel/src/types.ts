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
