import { Controller, Get } from "@nestjs/common";
import {
  RuntimeWsOperationsState,
  type RuntimeWsOperationsSnapshot
} from "./runtime-ws-operations.state";

@Controller()
export class RuntimeWsHealthController {
  constructor(private readonly operationsState: RuntimeWsOperationsState) {}

  @Get("health/runtime-ws")
  health(): RuntimeWsOperationsSnapshot {
    return this.operationsState.snapshot();
  }
}
