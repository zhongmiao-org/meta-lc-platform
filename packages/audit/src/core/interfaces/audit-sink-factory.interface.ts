import type { RuntimeAuditSink } from "./audit-sink.interface";

export interface AuditSinkFactory<TConfig = unknown> {
  create(config: TConfig): RuntimeAuditSink;
}
