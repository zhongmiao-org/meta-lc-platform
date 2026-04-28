import type {
  MetaField,
  MetaTable
} from "./kernel.interface";

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
