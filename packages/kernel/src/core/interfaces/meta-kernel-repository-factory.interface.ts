import type { MetaKernelRepositoryPort } from "./meta-kernel.interface";

export interface MetaKernelRepositoryFactory<TConfig = unknown> {
  create(config: TConfig): MetaKernelRepositoryPort;
}
