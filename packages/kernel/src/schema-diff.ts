import type { MetaField, MetaSchema, MetaTable } from "./types";

export interface FieldChange {
  field: string;
  fromType: string;
  toType: string;
}

export interface TableDiff {
  table: string;
  addedFields: MetaField[];
  removedFields: MetaField[];
  changedFields: FieldChange[];
}

export interface SchemaDiff {
  addedTables: MetaTable[];
  removedTables: MetaTable[];
  changedTables: TableDiff[];
}

export function diffSchemas(from: MetaSchema, to: MetaSchema): SchemaDiff {
  const fromMap = new Map(from.tables.map((table) => [table.name, table]));
  const toMap = new Map(to.tables.map((table) => [table.name, table]));

  const addedTables: MetaTable[] = [];
  const removedTables: MetaTable[] = [];
  const changedTables: TableDiff[] = [];

  for (const table of to.tables) {
    if (!fromMap.has(table.name)) {
      addedTables.push(table);
    }
  }

  for (const table of from.tables) {
    if (!toMap.has(table.name)) {
      removedTables.push(table);
    }
  }

  for (const [tableName, fromTable] of fromMap.entries()) {
    const toTable = toMap.get(tableName);
    if (!toTable) {
      continue;
    }

    const fieldDiff = diffTableFields(tableName, fromTable.fields, toTable.fields);
    if (
      fieldDiff.addedFields.length > 0 ||
      fieldDiff.removedFields.length > 0 ||
      fieldDiff.changedFields.length > 0
    ) {
      changedTables.push(fieldDiff);
    }
  }

  return { addedTables, removedTables, changedTables };
}

export function generateMigrationSql(diff: SchemaDiff): string[] {
  const statements: string[] = [];

  for (const table of diff.addedTables) {
    const columns = table.fields
      .map((field) => `${quoteIdentifier(field.name)} ${toSqlType(field.type)}${field.nullable ? "" : " NOT NULL"}`)
      .join(", ");
    statements.push(`CREATE TABLE ${quoteIdentifier(table.name)} (${columns});`);
  }

  for (const table of diff.changedTables) {
    for (const field of table.addedFields) {
      statements.push(
        `ALTER TABLE ${quoteIdentifier(table.table)} ADD COLUMN ${quoteIdentifier(field.name)} ${toSqlType(field.type)}${field.nullable ? "" : " NOT NULL"};`
      );
    }
    for (const field of table.removedFields) {
      statements.push(`ALTER TABLE ${quoteIdentifier(table.table)} DROP COLUMN ${quoteIdentifier(field.name)};`);
    }
    for (const field of table.changedFields) {
      statements.push(
        `ALTER TABLE ${quoteIdentifier(table.table)} ALTER COLUMN ${quoteIdentifier(field.field)} TYPE ${toSqlType(field.toType)};`
      );
    }
  }

  for (const table of diff.removedTables) {
    statements.push(`DROP TABLE ${quoteIdentifier(table.name)};`);
  }

  return statements;
}

function diffTableFields(table: string, fromFields: MetaField[], toFields: MetaField[]): TableDiff {
  const fromMap = new Map(fromFields.map((field) => [field.name, field]));
  const toMap = new Map(toFields.map((field) => [field.name, field]));

  const addedFields: MetaField[] = [];
  const removedFields: MetaField[] = [];
  const changedFields: FieldChange[] = [];

  for (const field of toFields) {
    if (!fromMap.has(field.name)) {
      addedFields.push(field);
    }
  }

  for (const field of fromFields) {
    if (!toMap.has(field.name)) {
      removedFields.push(field);
      continue;
    }

    const target = toMap.get(field.name);
    if (target && target.type !== field.type) {
      changedFields.push({
        field: field.name,
        fromType: field.type,
        toType: target.type
      });
    }
  }

  return { table, addedFields, removedFields, changedFields };
}

function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return `"${value}"`;
}

function toSqlType(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === "string") return "TEXT";
  if (normalized === "number") return "INTEGER";
  if (normalized === "boolean") return "BOOLEAN";
  if (normalized === "date") return "TIMESTAMPTZ";
  if (normalized === "uuid") return "UUID";
  return type.toUpperCase();
}
