import type {
  RuntimeAuditEvent,
  RuntimeAuditObserver
} from "@zhongmiao/meta-lc-audit";
import type { ExecutionPlan, RuntimeContext } from "../../core/types";

export interface RuntimeAuditDispatchContext {
  observer?: RuntimeAuditObserver;
  requestId: string;
  planId: string;
  viewName?: string;
  tenantId?: string;
  userId?: string;
}

export type RuntimeAuditEventInput = Omit<
  RuntimeAuditEvent,
  "requestId" | "planId" | "timestamp" | "viewName" | "tenantId" | "userId"
>;

export function createRuntimeAuditDispatchContext(
  context: RuntimeContext,
  observer?: RuntimeAuditObserver,
  plan?: ExecutionPlan
): RuntimeAuditDispatchContext {
  const requestId = readContextString(context.requestId) ?? readContextString(readNestedContext(context, "requestId"));
  const planId = readContextString(context.planId) ?? requestId ?? createFallbackPlanId(plan);

  return {
    observer,
    requestId: requestId ?? planId,
    planId,
    viewName: readContextString(context.viewName) ?? readContextString(readNestedContext(context, "viewName")),
    tenantId: readContextString(context.tenantId) ?? readContextString(readNestedContext(context, "tenantId")),
    userId: readContextString(context.userId) ?? readContextString(readNestedContext(context, "userId"))
  };
}

export function emitRuntimeAuditEvent(
  context: RuntimeAuditDispatchContext | undefined,
  input: RuntimeAuditEventInput
): void {
  if (!context?.observer) {
    return;
  }

  const event = {
    ...input,
    requestId: context.requestId,
    planId: context.planId,
    timestamp: new Date().toISOString(),
    viewName: context.viewName,
    tenantId: context.tenantId,
    userId: context.userId
  } as RuntimeAuditEvent;

  try {
    const result = context.observer.recordRuntimeEvent(event);
    if (isPromiseLike(result)) {
      void result.catch(() => undefined);
    }
  } catch {
    // Observability must never alter runtime execution.
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createFallbackPlanId(plan?: ExecutionPlan): string {
  if (!plan) {
    return "runtime-plan";
  }

  const nodeIds = plan.nodes.map((node) => node.id).sort((left, right) => left.localeCompare(right));
  return `runtime-plan:${nodeIds.join(",") || "empty"}`;
}

function readNestedContext(context: RuntimeContext, key: string): unknown {
  const nested = context.context;
  if (!isRecordLike(nested)) {
    return undefined;
  }
  return nested[key];
}

function readContextString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> & { catch(onRejected: () => void): unknown } {
  return isRecordLike(value) && typeof value.catch === "function";
}
