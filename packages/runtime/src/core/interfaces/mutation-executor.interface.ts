import type { MutationDatasourceAdapter } from "./runtime-adapter.interface";

export interface MutationExecutorDependencies {
  adapter: MutationDatasourceAdapter;
}
