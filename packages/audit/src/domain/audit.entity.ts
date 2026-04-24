import type { QueryAuditLog } from "@zhongmiao/meta-lc-contracts";

export type RuntimeAuditEventType =
  | "runtime.plan.started"
  | "runtime.plan.finished"
  | "runtime.node.succeeded"
  | "runtime.node.failed"
  | "runtime.permission.decision"
  | "runtime.datasource.succeeded"
  | "runtime.datasource.failed";

export type RuntimeAuditEventStatus = "started" | "success" | "failure" | "allow" | "deny";

export interface RuntimeAuditEventBase {
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
}

export interface RuntimePlanStartedAuditEvent extends RuntimeAuditEventBase {
  type: "runtime.plan.started";
  status: "started";
}

export interface RuntimePlanFinishedAuditEvent extends RuntimeAuditEventBase {
  type: "runtime.plan.finished";
  status: "success" | "failure";
}

export interface RuntimeNodeSucceededAuditEvent extends RuntimeAuditEventBase {
  type: "runtime.node.succeeded";
  status: "success";
  nodeId: string;
  nodeType: string;
}

export interface RuntimeNodeFailedAuditEvent extends RuntimeAuditEventBase {
  type: "runtime.node.failed";
  status: "failure";
  nodeId: string;
  nodeType: string;
}

export interface RuntimePermissionDecisionAuditEvent extends RuntimeAuditEventBase {
  type: "runtime.permission.decision";
  status: "allow" | "deny";
  nodeId?: string;
  nodeType?: string;
}

export interface RuntimeDatasourceSucceededAuditEvent extends RuntimeAuditEventBase {
  type: "runtime.datasource.succeeded";
  status: "success";
  nodeId?: string;
  nodeType?: string;
}

export interface RuntimeDatasourceFailedAuditEvent extends RuntimeAuditEventBase {
  type: "runtime.datasource.failed";
  status: "failure";
  nodeId?: string;
  nodeType?: string;
}

export type RuntimeAuditEvent =
  | RuntimePlanStartedAuditEvent
  | RuntimePlanFinishedAuditEvent
  | RuntimeNodeSucceededAuditEvent
  | RuntimeNodeFailedAuditEvent
  | RuntimePermissionDecisionAuditEvent
  | RuntimeDatasourceSucceededAuditEvent
  | RuntimeDatasourceFailedAuditEvent;

export interface RuntimeAuditObserver {
  recordRuntimeEvent(event: RuntimeAuditEvent): void | Promise<void>;
}

export interface RuntimeAuditSink extends RuntimeAuditObserver {}

export interface MutationAuditLog {
  requestId: string;
  tenantId: string;
  userId: string;
  table: string;
  action: "create" | "update" | "delete";
  payload: string;
  status: "success" | "failure";
  errorMessage?: string | null;
}

export interface MigrationAuditLog {
  requestId: string;
  appId: string;
  fromVersion: number;
  toVersion: number;
  statement: string;
  status: "success" | "failure" | "blocked";
  durationMs: number;
  errorMessage?: string | null;
}

export interface AccessAuditLog {
  requestId: string;
  tenantId: string;
  userId: string;
  resource: string;
  action: string;
  status: "allow" | "deny";
  reason?: string;
}

export interface AuditSink {
  logQuery(log: QueryAuditLog): Promise<void>;
  logMutation(log: MutationAuditLog): Promise<void>;
  logMigration(log: MigrationAuditLog): Promise<void>;
  logAccess(log: AccessAuditLog): Promise<void>;
  recordRuntimeEvent?(event: RuntimeAuditEvent): Promise<void>;
  close?(): Promise<void>;
}
