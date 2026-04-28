import type { DbConfig, MetaKernelRepositoryFactory } from "@zhongmiao/meta-lc-kernel";
import { PostgresMetaKernelRepository } from "../repository/postgres-meta-kernel.repository";

export class PostgresMetaKernelRepositoryFactory implements MetaKernelRepositoryFactory<DbConfig> {
  create(config: DbConfig): PostgresMetaKernelRepository {
    return new PostgresMetaKernelRepository(config);
  }
}
