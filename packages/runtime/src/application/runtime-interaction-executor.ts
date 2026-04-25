import type { RuntimeManagerCommand, RuntimeManagerPlan } from "./executor/runtime-executor";

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

export type RuntimeInteractionCommandResult =
  | {
      type: "patchState";
      patch: Record<string, unknown>;
    }
  | {
      type: "refreshDatasource";
      datasourceId: string;
      result: unknown;
    }
  | {
      type: "runAction";
      actionId: string;
      result: unknown;
    };

export interface RuntimeInteractionExecutionRequest {
  plan: RuntimeManagerPlan;
  port: RuntimeInteractionPort;
}

export interface RuntimeInteractionExecutionResult {
  nextState: Record<string, unknown>;
  commandResults: RuntimeInteractionCommandResult[];
  wsTopics: string[];
}

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

export interface RecordingRuntimeInteractionPort extends RuntimeInteractionPort {
  readonly calls: RuntimeManagerCommand[];
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
