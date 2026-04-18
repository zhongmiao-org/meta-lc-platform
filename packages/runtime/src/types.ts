import type {
  RuntimeActionDefinition,
  RuntimeDatasourceDefinition,
  RuntimeNodeSchema,
  RuntimePageDsl,
  RuntimeTemplateDependency
} from "@meta-lc/contracts";

export interface ParsedRuntimeDatasourceDefinition extends RuntimeDatasourceDefinition {
  dependencies: RuntimeTemplateDependency[];
}

export interface ParsedRuntimeActionDefinition extends RuntimeActionDefinition {
  dependencies: RuntimeTemplateDependency[];
}

export interface ParsedRuntimeNodeSchema extends RuntimeNodeSchema {
  dependencies: RuntimeTemplateDependency[];
  children?: ParsedRuntimeNodeSchema[];
}

export interface ParsedRuntimePageDsl extends RuntimePageDsl {
  datasources: ParsedRuntimeDatasourceDefinition[];
  actions: ParsedRuntimeActionDefinition[];
  layoutTree: ParsedRuntimeNodeSchema[];
  dependencies: {
    datasources: Record<string, RuntimeTemplateDependency[]>;
    actions: Record<string, RuntimeTemplateDependency[]>;
    layoutNodes: Record<string, RuntimeTemplateDependency[]>;
  };
}

export interface RuntimeDslValidationIssue {
  path: string;
  message: string;
}

export class RuntimeDslParseError extends Error {
  constructor(public readonly issues: RuntimeDslValidationIssue[]) {
    super(
      `Invalid runtime DSL: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`
    );
    this.name = "RuntimeDslParseError";
  }
}
