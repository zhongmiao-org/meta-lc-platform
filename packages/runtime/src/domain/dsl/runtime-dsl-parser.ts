import type {
  RuntimeActionDefinition,
  RuntimeDatasourceDefinition,
  RuntimeNodeSchema,
  RuntimeRuleDefinition,
  RuntimePageDsl
} from "@zhongmiao/meta-lc-contracts";
import { collectTemplateDependencies } from "./template-resolver";
import {
  collectRuleStateDependencies,
  type ParsedRuntimeActionDefinition,
  type ParsedRuntimeDatasourceDefinition,
  type ParsedRuntimeNodeSchema,
  type ParsedRuntimePageDsl,
  type ParsedRuntimeRuleDefinition,
  RuntimeDslParseError,
  type RuntimeDslValidationIssue
} from "../../types";

export function parseRuntimePageDsl(input: RuntimePageDsl): ParsedRuntimePageDsl {
  const issues = validateRuntimePageDsl(input);
  if (issues.length > 0) {
    throw new RuntimeDslParseError(issues);
  }

  const datasources = input.datasources.map<ParsedRuntimeDatasourceDefinition>((datasource) => ({
    ...datasource,
    dependencies: collectTemplateDependencies(datasource)
  }));
  const actions = input.actions.map<ParsedRuntimeActionDefinition>((action) => ({
    ...action,
    dependencies: collectTemplateDependencies(action),
    outputStateKeys: []
  }));
  const rules = (input.rules ?? []).map<ParsedRuntimeRuleDefinition>((rule) => ({
    ...rule,
    stateDependencies: collectRuleStateDependencies(rule.condition.call)
  }));
  const layoutTree = input.layoutTree.map((node) => parseLayoutNode(node));

  return {
    ...input,
    datasources,
    actions,
    rules,
    layoutTree,
    stateKeys: Object.keys(input.state).sort((left, right) => left.localeCompare(right)),
    dependencies: {
      datasources: Object.fromEntries(datasources.map((datasource) => [datasource.id, datasource.dependencies])),
      actions: Object.fromEntries(actions.map((action) => [action.id, action.dependencies])),
      rules: Object.fromEntries(rules.map((rule) => [rule.id, rule.stateDependencies])),
      layoutNodes: Object.fromEntries(flattenLayoutNodes(layoutTree).map((node) => [node.id, node.dependencies]))
    }
  };
}

function validateRuntimePageDsl(input: RuntimePageDsl): RuntimeDslValidationIssue[] {
  const issues: RuntimeDslValidationIssue[] = [];
  if (!input.schemaVersion?.trim()) {
    issues.push({ path: "schemaVersion", message: "is required." });
  }
  if (!input.pageMeta?.id?.trim()) {
    issues.push({ path: "pageMeta.id", message: "is required." });
  }
  if (!input.pageMeta?.title?.trim()) {
    issues.push({ path: "pageMeta.title", message: "is required." });
  }
  if (!isPlainObject(input.state)) {
    issues.push({ path: "state", message: "must be an object." });
  }
  if (!Array.isArray(input.datasources)) {
    issues.push({ path: "datasources", message: "must be an array." });
  }
  if (!Array.isArray(input.actions)) {
    issues.push({ path: "actions", message: "must be an array." });
  }
  if (!Array.isArray(input.layoutTree)) {
    issues.push({ path: "layoutTree", message: "must be an array." });
  }
  if (input.rules !== undefined && !Array.isArray(input.rules)) {
    issues.push({ path: "rules", message: "must be an array when provided." });
  }

  collectDuplicateIdIssues(input.datasources, "datasources", issues);
  collectDuplicateIdIssues(input.actions, "actions", issues);
  collectDuplicateRuleIdIssues(input.rules ?? [], issues);
  collectLayoutIssues(input.layoutTree, "layoutTree", issues);

  input.datasources.forEach((datasource, index) => {
    if (!datasource.id?.trim()) {
      issues.push({ path: `datasources[${index}].id`, message: "is required." });
    }
    if (!datasource.type?.trim()) {
      issues.push({ path: `datasources[${index}].type`, message: "is required." });
    }
  });

  input.actions.forEach((action, index) => {
    if (!action.id?.trim()) {
      issues.push({ path: `actions[${index}].id`, message: "is required." });
    }
    if (!Array.isArray(action.steps) || action.steps.length === 0) {
      issues.push({ path: `actions[${index}].steps`, message: "must contain at least one step." });
    }
  });

  (input.rules ?? []).forEach((rule, index) => {
    if (!rule.id?.trim()) {
      issues.push({ path: `rules[${index}].id`, message: "is required." });
    }
    if (!rule.trigger?.trim()) {
      issues.push({ path: `rules[${index}].trigger`, message: "is required." });
    }
    if (!rule.condition?.call?.name?.trim()) {
      issues.push({ path: `rules[${index}].condition.call.name`, message: "is required." });
    }
    if (!Array.isArray(rule.condition?.call?.args)) {
      issues.push({ path: `rules[${index}].condition.call.args`, message: "must be an array." });
    }
    if (!Array.isArray(rule.effects) || rule.effects.length === 0) {
      issues.push({ path: `rules[${index}].effects`, message: "must contain at least one effect." });
    }
  });

  return issues;
}

function collectDuplicateIdIssues(
  items: Array<RuntimeDatasourceDefinition | RuntimeActionDefinition>,
  path: string,
  issues: RuntimeDslValidationIssue[]
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (!item.id?.trim()) {
      return;
    }
    if (seen.has(item.id)) {
      issues.push({ path: `${path}[${index}].id`, message: `duplicates "${item.id}".` });
      return;
    }
    seen.add(item.id);
  });
}

function collectLayoutIssues(
  nodes: RuntimeNodeSchema[],
  path: string,
  issues: RuntimeDslValidationIssue[]
): void {
  const seen = new Set<string>();

  const visit = (node: RuntimeNodeSchema, nodePath: string): void => {
    if (!node.id?.trim()) {
      issues.push({ path: `${nodePath}.id`, message: "is required." });
    } else if (seen.has(node.id)) {
      issues.push({ path: `${nodePath}.id`, message: `duplicates "${node.id}".` });
    } else {
      seen.add(node.id);
    }

    if (!node.componentType?.trim()) {
      issues.push({ path: `${nodePath}.componentType`, message: "is required." });
    }

    if (!isPlainObject(node.props)) {
      issues.push({ path: `${nodePath}.props`, message: "must be an object." });
    }

    if (node.children !== undefined && !Array.isArray(node.children)) {
      issues.push({ path: `${nodePath}.children`, message: "must be an array when provided." });
      return;
    }

    node.children?.forEach((child, childIndex) => visit(child, `${nodePath}.children[${childIndex}]`));
  };

  nodes.forEach((node, index) => visit(node, `${path}[${index}]`));
}

function collectDuplicateRuleIdIssues(
  rules: RuntimeRuleDefinition[],
  issues: RuntimeDslValidationIssue[]
): void {
  const seen = new Set<string>();
  rules.forEach((rule, index) => {
    if (!rule.id?.trim()) {
      return;
    }
    if (seen.has(rule.id)) {
      issues.push({ path: `rules[${index}].id`, message: `duplicates "${rule.id}".` });
      return;
    }
    seen.add(rule.id);
  });
}

function parseLayoutNode(node: RuntimeNodeSchema): ParsedRuntimeNodeSchema {
  return {
    ...node,
    dependencies: collectTemplateDependencies(node),
    children: node.children?.map((child) => parseLayoutNode(child))
  };
}

function flattenLayoutNodes(nodes: ParsedRuntimeNodeSchema[]): ParsedRuntimeNodeSchema[] {
  return nodes.flatMap((node) => [node, ...flattenLayoutNodes(node.children ?? [])]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
