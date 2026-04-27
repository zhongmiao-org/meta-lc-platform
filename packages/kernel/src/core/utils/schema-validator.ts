import type {
  MetaApp,
  MetaField,
  MetaRule,
  MetaSchema,
  MetaTable,
  MetaTenant,
  SnapshotPermission,
  SnapshotRelation
} from "../interfaces";
import { REQUIRED_ROOT_KEYS } from "../constants";

export function validateSchema(schema: MetaSchema): void {
  if (!schema || typeof schema !== "object") {
    throw new Error("Schema must be an object.");
  }

  for (const key of REQUIRED_ROOT_KEYS) {
    if (!(key in schema)) {
      throw new Error(`Schema missing required key: ${key}`);
    }
  }

  if (!Array.isArray(schema.tables)) {
    throw new Error("Schema.tables must be an array.");
  }
  if (schema.relations !== undefined && !Array.isArray(schema.relations)) {
    throw new Error("Schema.relations must be an array when provided.");
  }
  if (schema.tenants !== undefined && !Array.isArray(schema.tenants)) {
    throw new Error("Schema.tenants must be an array when provided.");
  }
  if (schema.apps !== undefined && !Array.isArray(schema.apps)) {
    throw new Error("Schema.apps must be an array when provided.");
  }
  if (schema.rules !== undefined && !Array.isArray(schema.rules)) {
    throw new Error("Schema.rules must be an array when provided.");
  }
  if (schema.permissions !== undefined && !Array.isArray(schema.permissions)) {
    throw new Error("Schema.permissions must be an array when provided.");
  }

  const tableNames = new Set<string>();
  for (const table of schema.tables) {
    if (!table?.name) {
      throw new Error("Every table requires a name.");
    }
    if (tableNames.has(table.name)) {
      throw new Error(`Duplicate table name: ${table.name}.`);
    }
    tableNames.add(table.name);
    if (!Array.isArray(table.fields)) {
      throw new Error(`Table ${table.name} must define fields array.`);
    }
    validateFields(table);
    validateIndexes(table);
  }

  validateRelations(schema.tables, schema.relations ?? []);
  const tenantIds = validateTenants(schema.tenants ?? []);
  const appIds = validateApps(schema.apps ?? [], tenantIds);
  validateRules(schema.rules ?? [], appIds);
  validatePermissions(schema.permissions ?? []);
}

function validateFields(table: MetaTable): void {
  const fieldNames = new Set<string>();
  for (const field of table.fields) {
    if (!field?.name) {
      throw new Error(`Table ${table.name} has a field without a name.`);
    }
    if (fieldNames.has(field.name)) {
      throw new Error(`Duplicate field name "${field.name}" in table ${table.name}.`);
    }
    fieldNames.add(field.name);
  }
}

function validateTenants(tenants: MetaTenant[]): Set<string> {
  const tenantIds = new Set<string>();
  for (const tenant of tenants) {
    if (!tenant?.id) {
      throw new Error("Tenant requires an id.");
    }
    if (tenantIds.has(tenant.id)) {
      throw new Error(`Duplicate tenant id: ${tenant.id}.`);
    }
    tenantIds.add(tenant.id);
    if (!tenant.name) {
      throw new Error(`Tenant ${tenant.id} requires a name.`);
    }
  }
  return tenantIds;
}

function validateApps(apps: MetaApp[], tenantIds: Set<string>): Set<string> {
  const appIds = new Set<string>();
  for (const app of apps) {
    if (!app?.id) {
      throw new Error("App requires an id.");
    }
    if (appIds.has(app.id)) {
      throw new Error(`Duplicate app id: ${app.id}.`);
    }
    appIds.add(app.id);
    if (!app.tenantId) {
      throw new Error(`App ${app.id} requires a tenantId.`);
    }
    if (!tenantIds.has(app.tenantId)) {
      throw new Error(`App ${app.id} references unknown tenant "${app.tenantId}".`);
    }
    if (!app.name) {
      throw new Error(`App ${app.id} requires a name.`);
    }
  }
  return appIds;
}

function validateRules(rules: MetaRule[], appIds: Set<string>): void {
  const ruleIds = new Set<string>();
  for (const rule of rules) {
    if (!rule?.id) {
      throw new Error("Rule requires an id.");
    }
    if (ruleIds.has(rule.id)) {
      throw new Error(`Duplicate rule id: ${rule.id}.`);
    }
    ruleIds.add(rule.id);
    if (!rule.appId) {
      throw new Error(`Rule ${rule.id} requires an appId.`);
    }
    if (!appIds.has(rule.appId)) {
      throw new Error(`Rule ${rule.id} references unknown app "${rule.appId}".`);
    }
    if (!rule.trigger) {
      throw new Error(`Rule ${rule.id} requires a trigger.`);
    }
  }
}

function validatePermissions(permissions: SnapshotPermission[]): void {
  for (const permission of permissions) {
    if (!permission?.resource) {
      throw new Error("Permission requires a resource.");
    }
    if (!permission.action) {
      throw new Error(`Permission ${permission.resource} requires an action.`);
    }
    if (!Array.isArray(permission.roles) || permission.roles.length === 0) {
      throw new Error(`Permission ${permission.resource}:${permission.action} requires at least one role.`);
    }
    const roles = new Set<string>();
    for (const role of permission.roles) {
      if (!role) {
        throw new Error(`Permission ${permission.resource}:${permission.action} has an empty role.`);
      }
      if (roles.has(role)) {
        throw new Error(`Permission ${permission.resource}:${permission.action} has duplicate role "${role}".`);
      }
      roles.add(role);
    }
  }
}

function validateIndexes(table: MetaTable): void {
  if (table.indexes === undefined) {
    return;
  }
  if (!Array.isArray(table.indexes)) {
    throw new Error(`Table ${table.name} indexes must be an array when provided.`);
  }

  const fieldNames = new Set(table.fields.map((field: MetaField) => field.name));
  const indexNames = new Set<string>();
  for (const index of table.indexes) {
    if (!index?.name) {
      throw new Error(`Table ${table.name} has an index without a name.`);
    }
    if (indexNames.has(index.name)) {
      throw new Error(`Duplicate index name "${index.name}" in table ${table.name}.`);
    }
    indexNames.add(index.name);
    if (!Array.isArray(index.fields) || index.fields.length === 0) {
      throw new Error(`Index ${index.name} in table ${table.name} must define at least one field.`);
    }
    for (const field of index.fields) {
      if (!fieldNames.has(field)) {
        throw new Error(`Index ${index.name} in table ${table.name} references unknown field "${field}".`);
      }
    }
  }
}

function validateRelations(tables: MetaTable[], relations: SnapshotRelation[]): void {
  const tableMap = new Map(tables.map((table) => [table.name, new Set(table.fields.map((field) => field.name))]));

  for (const relation of relations) {
    if (!relation.fromTable || !relation.fromField || !relation.toTable || !relation.toField) {
      throw new Error("Relation must define fromTable, fromField, toTable, and toField.");
    }
    const fromFields = tableMap.get(relation.fromTable);
    if (!fromFields) {
      throw new Error(`Relation references unknown fromTable "${relation.fromTable}".`);
    }
    if (!fromFields.has(relation.fromField)) {
      throw new Error(`Relation references unknown fromField "${relation.fromField}" on table ${relation.fromTable}.`);
    }
    const toFields = tableMap.get(relation.toTable);
    if (!toFields) {
      throw new Error(`Relation references unknown toTable "${relation.toTable}".`);
    }
    if (!toFields.has(relation.toField)) {
      throw new Error(`Relation references unknown toField "${relation.toField}" on table ${relation.toTable}.`);
    }
  }
}
