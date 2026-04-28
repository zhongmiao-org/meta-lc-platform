import type { MergeExecutorHook } from "../types";

export interface MergeExecutorDependencies {
  hooks?: Record<string, MergeExecutorHook>;
}
