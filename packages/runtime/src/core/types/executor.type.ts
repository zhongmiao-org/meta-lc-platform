import type {
  DatasourceExecutionResult
} from "@zhongmiao/meta-lc-datasource";
import type { NodeDefinition } from "@zhongmiao/meta-lc-kernel";
import type { RuntimeAuditEvent } from "@zhongmiao/meta-lc-audit";
import type {
  NodeExecutionMetadata
} from "../interfaces";
import type {
  RuntimeContext
} from "./runtime.type";
import type { RuntimeStateStore } from "../interfaces";

export type RuntimeManagerCommand =
  | {
      type: "patchState";
      patch: Record<string, unknown>;
    }
  | {
      type: "refreshDatasource";
      datasourceId: string;
    }
  | {
      type: "runAction";
      actionId: string;
    };

export type NodeExecutionResult = unknown;

export type NodeTypeExecutor<TNode extends NodeDefinition = NodeDefinition> = (
  node: TNode,
  state: RuntimeStateStore,
  context: RuntimeContext,
  metadata?: NodeExecutionMetadata
) => NodeExecutionResult | Promise<NodeExecutionResult>;

export type MergeExecutorResult = unknown;

export type MergeExecutorHook = (
  inputs: Record<string, unknown>,
  context: RuntimeContext
) => MergeExecutorResult | Promise<MergeExecutorResult>;

export type RuntimeAuditEventInput = Omit<
  RuntimeAuditEvent,
  "requestId" | "planId" | "timestamp" | "viewName" | "tenantId" | "userId"
>;

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

export type QueryDatasourceExecutionResult = DatasourceExecutionResult;
