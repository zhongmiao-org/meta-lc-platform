import type {
  RuntimeManagerExecutedEvent,
  RuntimePageTopicRef
} from "../../core/interfaces";
import { createRuntimeManagerExecutedEvent } from "../../core/factories";
import type { RuntimeInteractionExecutionResult } from "../runtime-interaction-executor";

export interface CreateRuntimeManagerExecutionWsEventRequest {
  page: RuntimePageTopicRef;
  executionResult: RuntimeInteractionExecutionResult;
  requestId?: string;
}

export function createRuntimeManagerExecutionWsEvent(
  request: CreateRuntimeManagerExecutionWsEventRequest
): RuntimeManagerExecutedEvent {
  const patchState: Record<string, unknown> = {};
  const refreshedDatasourceIds: string[] = [];
  const runActionIds: string[] = [];

  for (const result of request.executionResult.commandResults) {
    if (result.type === "patchState") {
      Object.assign(patchState, result.patch);
      continue;
    }

    if (result.type === "refreshDatasource") {
      refreshedDatasourceIds.push(result.datasourceId);
      continue;
    }

    runActionIds.push(result.actionId);
  }

  return createRuntimeManagerExecutedEvent({
    page: request.page,
    ...(request.requestId ? { requestId: request.requestId } : {}),
    patchState,
    refreshedDatasourceIds,
    runActionIds
  });
}
