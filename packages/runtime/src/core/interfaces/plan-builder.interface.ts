import type {
  NodeDefinition,
  OutputDefinition,
  SubmitDefinition
} from "@zhongmiao/meta-lc-kernel";

export interface BuildExecutionPlanRequest {
  nodes: Record<string, NodeDefinition>;
  output: OutputDefinition;
  submit?: SubmitDefinition;
}
