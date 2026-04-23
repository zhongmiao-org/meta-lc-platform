import {
  type ExecutionPlan,
  type ViewDefinition,
  ViewCompilerError
} from "../types";
import { buildExecutionPlan } from "./plan-builder";

export function compileViewDefinition(view: ViewDefinition): ExecutionPlan {
  validateViewDefinition(view);
  return buildExecutionPlan({
    nodes: view.nodes,
    output: view.output,
    ...(view.submit ? { submit: view.submit } : {})
  });
}

function validateViewDefinition(view: ViewDefinition): void {
  if (!view.name?.trim()) {
    throw new ViewCompilerError("ViewDefinition.name is required.");
  }
  if (!isPlainObject(view.nodes)) {
    throw new ViewCompilerError("ViewDefinition.nodes must be an object.");
  }
  if (Object.keys(view.nodes).length === 0) {
    throw new ViewCompilerError("ViewDefinition.nodes must contain at least one node.");
  }
  if (!isPlainObject(view.output)) {
    throw new ViewCompilerError("ViewDefinition.output must be an object.");
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
