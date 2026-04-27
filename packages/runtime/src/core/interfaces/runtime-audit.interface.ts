import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";

export interface RuntimeAuditDispatchContext {
  observer?: RuntimeAuditObserver;
  requestId: string;
  planId: string;
  viewName?: string;
  tenantId?: string;
  userId?: string;
}
