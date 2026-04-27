import type { MetaField } from "../core/types/shared.types";

export function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return `"${value}"`;
}

export function toSqlType(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === "string") return "TEXT";
  if (normalized === "number") return "INTEGER";
  if (normalized === "boolean") return "BOOLEAN";
  if (normalized === "date") return "TIMESTAMPTZ";
  if (normalized === "uuid") return "UUID";
  return type.toUpperCase();
}

export function toColumnDefinition(field: MetaField): string {
  return `${quoteIdentifier(field.name)} ${toSqlType(field.type)}${field.nullable ? "" : " NOT NULL"}`;
}

export function createTableSql(tableName: string, fields: MetaField[]): string {
  const columns = fields.map((field) => toColumnDefinition(field)).join(", ");
  return `CREATE TABLE ${quoteIdentifier(tableName)} (${columns});`;
}
