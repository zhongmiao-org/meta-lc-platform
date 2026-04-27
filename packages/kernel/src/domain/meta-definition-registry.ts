import type {
  DatasourceDefinition,
  MetaDefinitionByKind,
  MetaDefinitionDiff,
  MetaDefinitionKind,
  PermissionPolicy,
  ViewDefinition
} from "../core/types/shared.types";

export function validateMetaDefinition<K extends MetaDefinitionKind>(
  kind: K,
  definition: MetaDefinitionByKind[K]
): void {
  if (kind === "view") {
    validateViewDefinition(definition as ViewDefinition);
    return;
  }
  if (kind === "datasource") {
    validateDatasourceDefinition(definition as DatasourceDefinition);
    return;
  }
  validatePermissionPolicy(definition as PermissionPolicy);
}

export function diffMetaDefinitions(input: {
  appId: string;
  kind: MetaDefinitionKind;
  id: string;
  fromVersion: number;
  toVersion: number;
  fromDefinition: unknown;
  toDefinition: unknown;
}): MetaDefinitionDiff {
  return {
    appId: input.appId,
    kind: input.kind,
    id: input.id,
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    changedPaths: collectChangedPaths(input.fromDefinition, input.toDefinition)
  };
}

function validateViewDefinition(definition: ViewDefinition): void {
  if (!definition || typeof definition !== "object") {
    throw new Error("ViewDefinition must be an object.");
  }
  if (!definition.name?.trim()) {
    throw new Error("ViewDefinition.name is required.");
  }
  if (!isPlainObject(definition.nodes) || Object.keys(definition.nodes).length === 0) {
    throw new Error("ViewDefinition.nodes must be a non-empty object.");
  }
  if (!isPlainObject(definition.output)) {
    throw new Error("ViewDefinition.output must be an object.");
  }
}

function validateDatasourceDefinition(definition: DatasourceDefinition): void {
  if (!definition || typeof definition !== "object") {
    throw new Error("DatasourceDefinition must be an object.");
  }
  if (!definition.id?.trim()) {
    throw new Error("DatasourceDefinition.id is required.");
  }
  if (!definition.type?.trim()) {
    throw new Error(`DatasourceDefinition ${definition.id || "__unknown__"} requires a type.`);
  }
}

function validatePermissionPolicy(policy: PermissionPolicy): void {
  if (!policy || typeof policy !== "object") {
    throw new Error("PermissionPolicy must be an object.");
  }
  if (!policy.id?.trim()) {
    throw new Error("PermissionPolicy.id is required.");
  }
  if (!policy.resource?.trim()) {
    throw new Error(`PermissionPolicy ${policy.id} requires a resource.`);
  }
  if (!policy.action?.trim()) {
    throw new Error(`PermissionPolicy ${policy.id} requires an action.`);
  }
  if (!Array.isArray(policy.roles) || policy.roles.length === 0) {
    throw new Error(`PermissionPolicy ${policy.id} requires at least one role.`);
  }

  const roles = new Set<string>();
  for (const role of policy.roles) {
    if (!role?.trim()) {
      throw new Error(`PermissionPolicy ${policy.id} has an empty role.`);
    }
    if (roles.has(role)) {
      throw new Error(`PermissionPolicy ${policy.id} has duplicate role "${role}".`);
    }
    roles.add(role);
  }
}

function collectChangedPaths(left: unknown, right: unknown, prefix = ""): string[] {
  if (Object.is(left, right)) {
    return [];
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return [prefix || "$"];
    }

    const paths: string[] = [];
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      paths.push(...collectChangedPaths(left[index], right[index], appendPath(prefix, String(index))));
    }
    return paths.sort();
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const paths: string[] = [];
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      paths.push(...collectChangedPaths(left[key], right[key], appendPath(prefix, key)));
    }
    return paths.sort();
  }

  return [prefix || "$"];
}

function appendPath(prefix: string, segment: string): string {
  return prefix ? `${prefix}.${segment}` : segment;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
