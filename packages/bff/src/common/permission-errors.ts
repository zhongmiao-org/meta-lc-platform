import { ForbiddenException } from "@nestjs/common";
import type { DataScopeDecision } from "@zhongmiao/meta-lc-permission";

export class ForbiddenDataScopeError extends ForbiddenException {
  constructor(public readonly details: { decision: DataScopeDecision; reason: string }) {
    super("data scope permission denied");
  }
}
