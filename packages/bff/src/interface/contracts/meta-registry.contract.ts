export type MetaResourceKind = "tables" | "pages" | "datasources" | "rules" | "permissions";

export interface MetaRegistryItem {
  id: string;
  name: string;
  updatedAt: string;
  [key: string]: unknown;
}
