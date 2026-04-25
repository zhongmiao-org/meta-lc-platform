export type MetaResourceKind = "tables" | "pages" | "datasources" | "rules" | "permissions";

export type MetaRegistryItem = {
  id: string;
  name: string;
  updatedAt: string;
  [key: string]: unknown;
};
