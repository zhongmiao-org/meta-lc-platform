import type { MutationAdapterCommand, MutationAdapterResult } from "../../types";

export interface MutationDatasourceAdapter {
  execute(command: MutationAdapterCommand): Promise<MutationAdapterResult>;
}

export function createMutationDatasourceAdapter(adapter: MutationDatasourceAdapter): MutationDatasourceAdapter {
  return adapter;
}
