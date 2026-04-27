import type {
  RuntimeManagerExecutedEvent,
  RuntimePageTopicRef
} from "./runtime.interface";
import type { RuntimeInteractionExecutionResult } from "./runtime-interaction.interface";

export interface CreateRuntimeManagerExecutionWsEventRequest {
  page: RuntimePageTopicRef;
  executionResult: RuntimeInteractionExecutionResult;
  requestId?: string;
}
