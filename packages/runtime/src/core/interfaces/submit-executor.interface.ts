import type {
  MutationExecutionResult,
  RuntimeExecutionResult
} from "./runtime.interface";

export interface SubmitExecutionResult extends RuntimeExecutionResult {
  submittedNodeIds: string[];
  executedNodeIds: string[];
  skippedNodeIds: string[];
  mutationResults: Record<string, MutationExecutionResult>;
}
