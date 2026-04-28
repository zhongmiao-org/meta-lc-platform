import type {
  CreateRuntimeManagerExecutedEventRequest,
  RuntimeManagerExecutedEvent
} from "../interfaces";
import { buildRuntimePageTopic } from "../utils";

export function createRuntimeManagerExecutedEvent(
  request: CreateRuntimeManagerExecutedEventRequest
): RuntimeManagerExecutedEvent {
  return {
    type: "runtime.manager.executed",
    topic: buildRuntimePageTopic(request.page),
    page: { ...request.page },
    ...(request.requestId ? { requestId: request.requestId } : {}),
    patchState: { ...(request.patchState ?? {}) },
    refreshedDatasourceIds: [...(request.refreshedDatasourceIds ?? [])],
    runActionIds: [...(request.runActionIds ?? [])]
  };
}
