import type { RuntimeManagerCommand, RuntimeManagerPlan } from "./executor/runtime-executor";

export interface RuntimeManagerAdapter {
  patchState?(patch: Record<string, unknown>, context: RuntimeManagerAdapterContext): void | Promise<void>;
  refreshDatasource?(datasourceId: string, context: RuntimeManagerAdapterContext): unknown | Promise<unknown>;
  runAction?(actionId: string, context: RuntimeManagerAdapterContext): unknown | Promise<unknown>;
}

export interface RuntimeManagerAdapterContext {
  state: Record<string, unknown>;
  commandIndex: number;
  plan: RuntimeManagerPlan;
}

export type RuntimeManagerCommandResult =
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

export interface RuntimeManagerExecutionRequest {
  plan: RuntimeManagerPlan;
  adapter: RuntimeManagerAdapter;
}

export interface RuntimeManagerExecutionResult {
  nextState: Record<string, unknown>;
  commandResults: RuntimeManagerCommandResult[];
  wsTopics: string[];
}

export async function executeRuntimeManagerPlan(
  request: RuntimeManagerExecutionRequest
): Promise<RuntimeManagerExecutionResult> {
  let nextState = { ...request.plan.nextState };
  const commandResults: RuntimeManagerCommandResult[] = [];

  for (const [commandIndex, command] of request.plan.managerCommands.entries()) {
    const context: RuntimeManagerAdapterContext = {
      state: nextState,
      commandIndex,
      plan: request.plan
    };

    if (command.type === "patchState") {
      await request.adapter.patchState?.(command.patch, context);
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
      const result = await request.adapter.refreshDatasource?.(command.datasourceId, context);
      commandResults.push({
        type: "refreshDatasource",
        datasourceId: command.datasourceId,
        result
      });
      continue;
    }

    const result = await request.adapter.runAction?.(command.actionId, context);
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

export interface RecordingRuntimeManagerAdapter extends RuntimeManagerAdapter {
  readonly calls: RuntimeManagerCommand[];
}

export function createRecordingRuntimeManagerAdapter(): RecordingRuntimeManagerAdapter {
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
