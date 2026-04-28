import type {
  AuditSinkFactory,
  PostgresRuntimeAuditConfig
} from "../../core/interfaces";
import { PostgresRuntimeAuditSink } from "../postgres-runtime-audit.sink";

export class PostgresRuntimeAuditSinkFactory implements AuditSinkFactory<PostgresRuntimeAuditConfig> {
  create(config: PostgresRuntimeAuditConfig): PostgresRuntimeAuditSink {
    return new PostgresRuntimeAuditSink(config);
  }
}

export function createPostgresRuntimeAuditSink(config: PostgresRuntimeAuditConfig): PostgresRuntimeAuditSink {
  return new PostgresRuntimeAuditSinkFactory().create(config);
}
