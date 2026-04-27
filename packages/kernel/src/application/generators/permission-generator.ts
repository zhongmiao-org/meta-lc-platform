import type { CompiledPermissionManifest, CompiledPermissionRule, SnapshotPermission } from "../../core/types/shared.types";

export function compilePermissionManifest(permissions: SnapshotPermission[]): CompiledPermissionManifest {
  if (!Array.isArray(permissions)) {
    throw new Error("Permissions must be an array.");
  }

  return {
    source: "snapshot-permissions",
    rules: permissions.map((permission) => createPermissionRule(permission))
  };
}

function createPermissionRule(permission: SnapshotPermission): CompiledPermissionRule {
  if (!permission?.resource) {
    throw new Error("Permission requires a resource.");
  }
  if (!permission.action) {
    throw new Error(`Permission ${permission.resource} requires an action.`);
  }
  if (!Array.isArray(permission.roles) || permission.roles.length === 0) {
    throw new Error(`Permission ${permission.resource}:${permission.action} requires at least one role.`);
  }

  const roles = new Set<string>();
  for (const role of permission.roles) {
    if (!role) {
      throw new Error(`Permission ${permission.resource}:${permission.action} has an empty role.`);
    }
    if (roles.has(role)) {
      throw new Error(`Permission ${permission.resource}:${permission.action} has duplicate role "${role}".`);
    }
    roles.add(role);
  }

  return {
    id: `${permission.resource}.${permission.action}`,
    resource: permission.resource,
    action: permission.action,
    roles: [...permission.roles],
    effect: "allow",
    enforcement: "rbac"
  };
}
