import { createHash } from "node:crypto";
import type {
  CompiledMigrationSql,
  MigrationAction,
  MigrationDslV1,
  SnapshotV1
} from "../core/types/shared.types";
import { diffSchemas } from "./schema-diff";
import { createTableSql, quoteIdentifier, toColumnDefinition, toSqlType } from "../utils/sql-utils";

export function computeSnapshotChecksum(snapshot: Omit<SnapshotV1, "checksum">): string {
  return sha256(stableStringify(snapshot));
}

export function computeMigrationDslChecksum(dsl: Omit<MigrationDslV1, "checksum">): string {
  return sha256(stableStringify(dsl));
}

export function validateSnapshotV1(snapshot: SnapshotV1): void {
  if (!snapshot.version || typeof snapshot.version !== "string") {
    throw new Error("SnapshotV1.version is required.");
  }
  if (!Array.isArray(snapshot.tables)) {
    throw new Error("SnapshotV1.tables must be an array.");
  }
  if (!Array.isArray(snapshot.relations)) {
    throw new Error("SnapshotV1.relations must be an array.");
  }
  if (!Array.isArray(snapshot.permissions)) {
    throw new Error("SnapshotV1.permissions must be an array.");
  }
  const expected = computeSnapshotChecksum({
    version: snapshot.version,
    tables: snapshot.tables,
    relations: snapshot.relations,
    permissions: snapshot.permissions
  });
  if (snapshot.checksum !== expected) {
    throw new Error("SnapshotV1 checksum mismatch.");
  }
}

export function validateMigrationDslV1(dsl: MigrationDslV1): void {
  if (!dsl.version || typeof dsl.version !== "string") {
    throw new Error("MigrationDslV1.version is required.");
  }
  if (!Array.isArray(dsl.actions)) {
    throw new Error("MigrationDslV1.actions must be an array.");
  }
  for (const action of dsl.actions) {
    if (!action?.type) {
      throw new Error("MigrationDslV1 action type is required.");
    }
  }
  const expected = computeMigrationDslChecksum({
    version: dsl.version,
    actions: dsl.actions
  });
  if (dsl.checksum !== expected) {
    throw new Error("MigrationDslV1 checksum mismatch.");
  }
}

export function buildMigrationDslFromSnapshots(
  fromSnapshot: SnapshotV1,
  toSnapshot: SnapshotV1
): MigrationDslV1 {
  validateSnapshotV1(fromSnapshot);
  validateSnapshotV1(toSnapshot);

  const diff = diffSchemas(
    { tables: fromSnapshot.tables },
    { tables: toSnapshot.tables }
  );
  const actions: MigrationAction[] = [];

  for (const table of diff.addedTables) {
    actions.push({
      type: "create_table",
      table
    });
  }

  for (const table of diff.changedTables) {
    for (const field of table.addedFields) {
      actions.push({
        type: "add_column",
        table: table.table,
        column: field
      });
    }
    for (const field of table.changedFields) {
      actions.push({
        type: "alter_column",
        table: table.table,
        columnName: field.field,
        fromType: field.fromType,
        toType: field.toType
      });
    }
    for (const field of table.removedFields) {
      actions.push({
        type: "drop_column",
        table: table.table,
        column: field
      });
    }
  }

  for (const table of diff.removedTables) {
    actions.push({
      type: "drop_table",
      table
    });
  }

  const payload = {
    version: toSnapshot.version,
    actions
  };
  return {
    ...payload,
    checksum: computeMigrationDslChecksum(payload)
  };
}

export function compileMigrationDslToSql(dsl: MigrationDslV1): CompiledMigrationSql {
  validateMigrationDslV1(dsl);
  const up: string[] = [];
  const down: string[] = [];

  for (const action of dsl.actions) {
    if (action.type === "create_table") {
      up.push(createTableSql(action.table.name, action.table.fields));
      down.unshift(`DROP TABLE ${quoteIdentifier(action.table.name)};`);
      continue;
    }
    if (action.type === "drop_table") {
      up.push(`DROP TABLE ${quoteIdentifier(action.table.name)};`);
      down.unshift(createTableSql(action.table.name, action.table.fields));
      continue;
    }
    if (action.type === "add_column") {
      up.push(
        `ALTER TABLE ${quoteIdentifier(action.table)} ADD COLUMN ${toColumnDefinition(action.column)};`
      );
      down.unshift(
        `ALTER TABLE ${quoteIdentifier(action.table)} DROP COLUMN ${quoteIdentifier(action.column.name)};`
      );
      continue;
    }
    if (action.type === "drop_column") {
      up.push(
        `ALTER TABLE ${quoteIdentifier(action.table)} DROP COLUMN ${quoteIdentifier(action.column.name)};`
      );
      down.unshift(
        `ALTER TABLE ${quoteIdentifier(action.table)} ADD COLUMN ${toColumnDefinition(action.column)};`
      );
      continue;
    }
    if (action.type === "alter_column") {
      up.push(
        `ALTER TABLE ${quoteIdentifier(action.table)} ALTER COLUMN ${quoteIdentifier(action.columnName)} TYPE ${toSqlType(action.toType)};`
      );
      down.unshift(
        `ALTER TABLE ${quoteIdentifier(action.table)} ALTER COLUMN ${quoteIdentifier(action.columnName)} TYPE ${toSqlType(action.fromType)};`
      );
    }
  }

  return { up, down };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  const sortedKeys = Object.keys(object).sort();
  return `{${sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}
