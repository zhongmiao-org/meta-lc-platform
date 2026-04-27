import type {
  RecordingRuntimeInteractionPort,
  RuntimeInteractionContext,
  RuntimeInteractionExecutionRequest,
  RuntimeInteractionExecutionResult
} from "../../core/interfaces";
import type {
  RuntimeInteractionCommandResult,
  RuntimeManagerCommand
} from "../../core/types";

export async function executeRuntimeInteractionPlan(
  request: RuntimeInteractionExecutionRequest
): Promise<RuntimeInteractionExecutionResult> {
  let nextState = { ...request.plan.nextState };
  const commandResults: RuntimeInteractionCommandResult[] = [];

  for (const [commandIndex, command] of request.plan.managerCommands.entries()) {
    const context: RuntimeInteractionContext = {
      state: nextState,
      commandIndex,
      plan: request.plan
    };

    if (command.type === "patchState") {
      await request.port.patchState?.(command.patch, context);
      nextState = {
        ...nextState,
        ...command.patch
      };
      commandResults.push({
        type: "patchState",
        patch: command.patch
      });
      continue;
    }

    if (command.type === "refreshDatasource") {
      const result = await request.port.refreshDatasource?.(command.datasourceId, context);
      commandResults.push({
        type: "refreshDatasource",
        datasourceId: command.datasourceId,
        result
      });
      continue;
    }

    const result = await request.port.runAction?.(command.actionId, context);
    commandResults.push({
      type: "runAction",
      actionId: command.actionId,
      result
    });
  }

  return {
    nextState,
    commandResults,
    wsTopics: [...request.plan.wsTopics]
  };
}

export function createRecordingRuntimeInteractionPort(): RecordingRuntimeInteractionPort {
  const calls: RuntimeManagerCommand[] = [];
  return {
    calls,
    patchState: (patch) => {
      calls.push({ type: "patchState", patch });
    },
    refreshDatasource: (datasourceId) => {
      calls.push({ type: "refreshDatasource", datasourceId });
      return { datasourceId };
    },
    runAction: (actionId) => {
      calls.push({ type: "runAction", actionId });
      return { actionId };
    }
  };
}
