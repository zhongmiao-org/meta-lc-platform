import type { DbConfig } from "@zhongmiao/meta-lc-kernel";
import { PostgresMetaKernelRepository } from "../repository/postgres-meta-kernel.repository";

export function createPostgresMetaKernelRepository(config: DbConfig): PostgresMetaKernelRepository {
  return new PostgresMetaKernelRepository(config);
}
