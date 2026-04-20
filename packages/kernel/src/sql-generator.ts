import type { CompiledSchemaSql, MetaIndex, MetaSchema, MetaTable, SnapshotRelation } from "./types";
import { validateSchema } from "./contracts";
import { createTableSql, quoteIdentifier } from "./sql-utils";

export function compileSchemaSql(schema: MetaSchema): CompiledSchemaSql {
  validateSchema(schema);

  const tables = schema.tables.map((table) => createTableSql(table.name, table.fields));
  const indexes = schema.tables.flatMap((table) => (table.indexes ?? []).map((index) => createIndexSql(table, index)));
  const relations = (schema.relations ?? []).map((relation) => createRelationSql(relation));

  return {
    tables,
    indexes,
    relations,
    statements: [...tables, ...indexes, ...relations]
  };
}

function createIndexSql(table: MetaTable, index: MetaIndex): string {
  const unique = index.unique ? "UNIQUE " : "";
  const fields = index.fields.map((field) => quoteIdentifier(field)).join(", ");
  return `CREATE ${unique}INDEX ${quoteIdentifier(index.name)} ON ${quoteIdentifier(table.name)} (${fields});`;
}

function createRelationSql(relation: SnapshotRelation): string {
  const constraintName = `${relation.fromTable}_${relation.fromField}_fkey`;
  return [
    `ALTER TABLE ${quoteIdentifier(relation.fromTable)}`,
    `ADD CONSTRAINT ${quoteIdentifier(constraintName)}`,
    `FOREIGN KEY (${quoteIdentifier(relation.fromField)})`,
    `REFERENCES ${quoteIdentifier(relation.toTable)} (${quoteIdentifier(relation.toField)});`
  ].join(" ");
}
