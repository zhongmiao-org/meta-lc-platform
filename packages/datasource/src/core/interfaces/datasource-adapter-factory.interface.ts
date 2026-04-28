import type { DatasourceAdapter } from "./datasource.interface";

export interface DatasourceAdapterFactory<TConfig = unknown> {
  create(config: TConfig): DatasourceAdapter;
}
