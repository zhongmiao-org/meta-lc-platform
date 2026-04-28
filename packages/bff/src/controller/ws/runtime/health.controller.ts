import { Controller, Get } from "@nestjs/common";
import { RuntimeWsOperationsState } from "./operations.state";
import type { RuntimeWsOperationsSnapshot } from "./runtime-ws-event.type";

@Controller()
export class RuntimeWsHealthController {
  constructor(private readonly operationsState: RuntimeWsOperationsState) {}

  @Get("health/runtime-ws")
  health(): RuntimeWsOperationsSnapshot {
    return this.operationsState.snapshot();
  }
}
