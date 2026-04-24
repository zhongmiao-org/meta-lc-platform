import type { RuntimeExecutionResult } from "@zhongmiao/meta-lc-runtime";

export type TemporaryViewExecutionResult = {
  requestId: string;
  viewName: string;
  runtime: RuntimeExecutionResult;
};
