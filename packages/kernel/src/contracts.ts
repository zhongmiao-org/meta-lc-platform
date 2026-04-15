import type { MetaSchema } from "./types";

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

  for (const table of schema.tables) {
    if (!table?.name) {
      throw new Error("Every table requires a name.");
    }
    if (!Array.isArray(table.fields)) {
      throw new Error(`Table ${table.name} must define fields array.`);
    }
  }
}
