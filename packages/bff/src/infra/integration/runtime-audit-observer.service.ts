import { Injectable, Logger } from "@nestjs/common";
import type {
  RuntimeAuditEvent,
  RuntimeAuditObserver
} from "@zhongmiao/meta-lc-audit";
import { AuditPersistenceService } from "./audit.service";

@Injectable()
export class RuntimeAuditObserverService implements RuntimeAuditObserver {
  private readonly logger = new Logger("RuntimeAuditObserver");

  constructor(private readonly auditPersistence: AuditPersistenceService) {}

  async recordRuntimeEvent(event: RuntimeAuditEvent): Promise<void> {
    try {
      await this.auditPersistence.persistRuntimeEvent(event);
    } catch (error) {
      this.logger.warn(
        `runtime audit observer failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
