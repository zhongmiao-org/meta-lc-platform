import type {
  DatasourceAdapter,
  DatasourceAdapterFactory,
  DbConfig,
  PostgresOrgScopeData,
  PostgresOrgScopeInput
} from "../core/interfaces";
import { PostgresDatasourceAdapter } from "./postgres.adapter";
import { PostgresOrgScopeAdapter } from "./postgres-org-scope.adapter";

export class PostgresDatasourceAdapterFactory implements DatasourceAdapterFactory<DbConfig> {
  create(config: DbConfig): DatasourceAdapter & ClosableResource {
    return new PostgresDatasourceAdapter(config);
  }
}

export function createPostgresDatasourceAdapter(config: DbConfig): DatasourceAdapter & ClosableResource {
  return new PostgresDatasourceAdapterFactory().create(config);
}

export function createPostgresOrgScopeResolver(config: DbConfig): PostgresOrgScopeDataResolver & ClosableResource {
  return new PostgresOrgScopeAdapter(config);
}

interface PostgresOrgScopeDataResolver {
  resolve(input: PostgresOrgScopeInput): Promise<PostgresOrgScopeData>;
}

interface ClosableResource {
  close(): Promise<void>;
}
