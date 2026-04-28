import type { InMemoryMetaDefinitionSeed } from "../../core/interfaces";
import { InMemoryMetaKernelRepository } from "../../infra/persistence/in-memory-meta-kernel-repository";
import { MetaKernelService } from "../services/meta-kernel.service";

export function createInMemoryMetaKernelService(seed: { definitions?: InMemoryMetaDefinitionSeed[] } = {}): MetaKernelService {
  return new MetaKernelService(new InMemoryMetaKernelRepository(seed));
}
