export type RuntimeAuditEventType =
  | "runtime.plan.started"
  | "runtime.plan.finished"
  | "runtime.node.succeeded"
  | "runtime.node.failed"
  | "runtime.permission.decision"
  | "runtime.datasource.succeeded"
  | "runtime.datasource.failed";

export type RuntimeAuditEventStatus = "started" | "success" | "failure" | "allow" | "deny";

export type RuntimeAuditEventBase = {
  type: RuntimeAuditEventType;
  requestId: string;
  planId: string;
  timestamp: string;
  viewName?: string;
  nodeId?: string;
  nodeType?: string;
  tenantId?: string;
  userId?: string;
  durationMs?: number;
  status: RuntimeAuditEventStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export type RuntimePlanStartedAuditEvent = RuntimeAuditEventBase & {
  type: "runtime.plan.started";
  status: "started";
};

export type RuntimePlanFinishedAuditEvent = RuntimeAuditEventBase & {
  type: "runtime.plan.finished";
  status: "success" | "failure";
};

export type RuntimeNodeSucceededAuditEvent = RuntimeAuditEventBase & {
  type: "runtime.node.succeeded";
  status: "success";
  nodeId: string;
  nodeType: string;
};

export type RuntimeNodeFailedAuditEvent = RuntimeAuditEventBase & {
  type: "runtime.node.failed";
  status: "failure";
  nodeId: string;
  nodeType: string;
};

export type RuntimePermissionDecisionAuditEvent = RuntimeAuditEventBase & {
  type: "runtime.permission.decision";
  status: "allow" | "deny";
  nodeId?: string;
  nodeType?: string;
};

export type RuntimeDatasourceSucceededAuditEvent = RuntimeAuditEventBase & {
  type: "runtime.datasource.succeeded";
  status: "success";
  nodeId?: string;
  nodeType?: string;
};

export type RuntimeDatasourceFailedAuditEvent = RuntimeAuditEventBase & {
  type: "runtime.datasource.failed";
  status: "failure";
  nodeId?: string;
  nodeType?: string;
};

export type RuntimeAuditEvent =
  | RuntimePlanStartedAuditEvent
  | RuntimePlanFinishedAuditEvent
  | RuntimeNodeSucceededAuditEvent
  | RuntimeNodeFailedAuditEvent
  | RuntimePermissionDecisionAuditEvent
  | RuntimeDatasourceSucceededAuditEvent
  | RuntimeDatasourceFailedAuditEvent;
