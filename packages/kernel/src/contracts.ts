import type { MetaField, MetaSchema, MetaTable, SnapshotRelation } from "./types";

export const REQUIRED_ROOT_KEYS = ["tables"];

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
