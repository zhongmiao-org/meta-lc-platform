import type { MutationAdapterCommand, MutationAdapterResult } from "../../core/interfaces";

export interface MutationDatasourceAdapter {
  execute(command: MutationAdapterCommand): Promise<MutationAdapterResult>;
}

export function createMutationDatasourceAdapter(adapter: MutationDatasourceAdapter): MutationDatasourceAdapter {
  return adapter;
}
