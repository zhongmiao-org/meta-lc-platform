import type {
  RuntimeInteractionCommandResult,
  RuntimeManagerCommand
} from "../types";
import type { RuntimeManagerPlan } from "./runtime-executor.interface";

export interface RuntimeInteractionPort {
  patchState?(patch: Record<string, unknown>, context: RuntimeInteractionContext): void | Promise<void>;
  refreshDatasource?(datasourceId: string, context: RuntimeInteractionContext): unknown | Promise<unknown>;
  runAction?(actionId: string, context: RuntimeInteractionContext): unknown | Promise<unknown>;
}

export interface RuntimeInteractionContext {
  state: Record<string, unknown>;
  commandIndex: number;
  plan: RuntimeManagerPlan;
}

export interface RuntimeInteractionExecutionRequest {
  plan: RuntimeManagerPlan;
  port: RuntimeInteractionPort;
}

export interface RuntimeInteractionExecutionResult {
  nextState: Record<string, unknown>;
  commandResults: RuntimeInteractionCommandResult[];
  wsTopics: string[];
}

export interface RecordingRuntimeInteractionPort extends RuntimeInteractionPort {
  readonly calls: RuntimeManagerCommand[];
}
