import type { MergeStrategy } from "@zhongmiao/meta-lc-kernel";
import type {
  ExecutionNode,
  RuntimeDslValidationIssue
} from "../interfaces";
import type { RuntimeExecutionStage } from "../types";

export class RuntimeExecutionError extends Error {
  constructor(
    message: string,
    public readonly stage: RuntimeExecutionStage,
    public readonly cause?: unknown,
    public readonly nodeId?: string,
    public readonly nodeType?: ExecutionNode["type"]
  ) {
    super(message);
    this.name = "RuntimeExecutionError";
  }
}

export class ViewCompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewCompilerError";
  }
}

export class DagSchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DagSchedulerError";
  }
}

export class ExpressionResolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionResolverError";
  }
}

export class NodeExecutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeExecutorError";
  }
}

export class QueryExecutorError extends NodeExecutorError {
  constructor(
    message: string,
    public readonly stage: "validation" | "compile" | "execute",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "QueryExecutorError";
  }
}

export class MutationExecutorError extends NodeExecutorError {
  constructor(
    message: string,
    public readonly stage: "validation" | "execute",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "MutationExecutorError";
  }
}

export class MergeExecutorError extends NodeExecutorError {
  constructor(
    message: string,
    public readonly strategy?: MergeStrategy,
    public readonly hook?: string
  ) {
    super(message);
    this.name = "MergeExecutorError";
  }
}

export class RuntimeDslParseError extends Error {
  constructor(public readonly issues: RuntimeDslValidationIssue[]) {
    super(
      `Invalid runtime DSL: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`
    );
    this.name = "RuntimeDslParseError";
  }
}

export class RuntimeDependencyGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeDependencyGraphError";
  }
}

export class RuntimeFunctionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeFunctionRegistryError";
  }
}

export class RuntimeRuleEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeRuleEngineError";
  }
}
