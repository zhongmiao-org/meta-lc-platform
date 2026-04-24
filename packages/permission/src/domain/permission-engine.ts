import type {
  DataScopeDecision,
  DataScopeType,
  OrgScopeContext,
  PermissionContext,
  PermissionFilter,
  RoleDataPolicy
} from "../types/shared.types";

const SCOPE_PRIORITY: Record<DataScopeType, number> = {
  SELF: 10,
  DEPT: 20,
  DEPT_AND_CHILDREN: 30,
  CUSTOM_ORG_SET: 40,
  TENANT_ALL: 50
};

function defaultPolicyForRole(role: string): RoleDataPolicy | null {
  if (role === "SUPER_ADMIN") {
    return { role, scope: "TENANT_ALL" };
  }
  if (role === "MANAGER") {
    return { role, scope: "DEPT_AND_CHILDREN" };
  }
  return null;
}

function pickStrongestPolicy(policies: RoleDataPolicy[]): RoleDataPolicy {
  if (!policies.length) {
    return { role: "__default__", scope: "SELF" };
  }

  return [...policies].sort((a, b) => SCOPE_PRIORITY[b.scope] - SCOPE_PRIORITY[a.scope])[0];
}

function expandDeptAndChildrenOrgIds(context: OrgScopeContext): string[] {
  if (!context.userOrgIds.length) {
    return [];
  }

  const baseNodes = context.orgNodes.filter((node) => context.userOrgIds.includes(node.id));
  if (!baseNodes.length) {
    return [...context.userOrgIds];
  }

  const visible = new Set<string>(context.userOrgIds);
  for (const baseNode of baseNodes) {
    const prefix = `${baseNode.path}${baseNode.path.endsWith("/") ? "" : "/"}`;
    for (const node of context.orgNodes) {
      if (node.path === baseNode.path || node.path.startsWith(prefix)) {
        visible.add(node.id);
      }
    }
  }

  return [...visible];
}

export function resolveDataScope(context: OrgScopeContext): DataScopeDecision {
  const userRoles = new Set(context.roles);
  const effectivePolicies: RoleDataPolicy[] = [];

  for (const role of userRoles) {
    const configured = context.rolePolicies.find((policy) => policy.role === role);
    if (configured) {
      effectivePolicies.push(configured);
      continue;
    }
    const fallback = defaultPolicyForRole(role);
    if (fallback) {
      effectivePolicies.push(fallback);
    }
  }

  const strongest = pickStrongestPolicy(effectivePolicies);

  if (strongest.scope === "TENANT_ALL") {
    return {
      scope: strongest.scope,
      allowedOrgIds: [],
      tenantAll: true,
      legacyFallbackToCreatedBy: false,
      reason: `scope:${strongest.scope}`
    };
  }

  if (strongest.scope === "CUSTOM_ORG_SET") {
    return {
      scope: strongest.scope,
      allowedOrgIds: [...(strongest.customOrgIds ?? [])],
      tenantAll: false,
      legacyFallbackToCreatedBy: true,
      reason: `scope:${strongest.scope}`
    };
  }

  if (strongest.scope === "DEPT") {
    return {
      scope: strongest.scope,
      allowedOrgIds: [...context.userOrgIds],
      tenantAll: false,
      legacyFallbackToCreatedBy: true,
      reason: `scope:${strongest.scope}`
    };
  }

  if (strongest.scope === "DEPT_AND_CHILDREN") {
    return {
      scope: strongest.scope,
      allowedOrgIds: expandDeptAndChildrenOrgIds(context),
      tenantAll: false,
      legacyFallbackToCreatedBy: true,
      reason: `scope:${strongest.scope}`
    };
  }

  return {
    scope: "SELF",
    allowedOrgIds: [],
    tenantAll: false,
    legacyFallbackToCreatedBy: true,
    reason: "scope:SELF"
  };
}

/**
 * @deprecated Runtime query permissions should use transformSelectQueryAstWithPermission()
 * and let the query compiler render SQL from AST.
 */
export function buildDataScopeFilter(decision: DataScopeDecision, context: PermissionContext): PermissionFilter {
  if (decision.tenantAll) {
    return {
      clause: "tenant_id = $1",
      params: [context.tenantId]
    };
  }

  if (decision.scope === "SELF") {
    return {
      clause: "tenant_id = $1 AND created_by = $2",
      params: [context.tenantId, context.userId]
    };
  }

  if (!decision.allowedOrgIds.length) {
    return {
      clause: "1=0",
      params: []
    };
  }

  if (!decision.legacyFallbackToCreatedBy) {
    return {
      clause: "tenant_id = $1 AND org_id = ANY($2::text[])",
      params: [context.tenantId, decision.allowedOrgIds]
    };
  }

  return {
    clause: "tenant_id = $1 AND (org_id = ANY($2::text[]) OR (org_id IS NULL AND created_by = $3))",
    params: [context.tenantId, decision.allowedOrgIds, context.userId]
  };
}

export function canAccessOrg(
  decision: DataScopeDecision,
  payload: { orgId: string | null; createdBy: string | null },
  context: PermissionContext
): { allowed: boolean; fallbackUsed: boolean; reason: string } {
  if (decision.tenantAll) {
    return { allowed: true, fallbackUsed: false, reason: "tenant-all" };
  }

  if (decision.scope === "SELF") {
    const allowed = payload.createdBy === context.userId;
    return {
      allowed,
      fallbackUsed: true,
      reason: allowed ? "self-owner" : "self-owner-required"
    };
  }

  if (payload.orgId && decision.allowedOrgIds.includes(payload.orgId)) {
    return { allowed: true, fallbackUsed: false, reason: "org-allowed" };
  }

  if (!payload.orgId && decision.legacyFallbackToCreatedBy && payload.createdBy === context.userId) {
    return { allowed: true, fallbackUsed: true, reason: "legacy-created-by-fallback" };
  }

  return {
    allowed: false,
    fallbackUsed: false,
    reason: payload.orgId ? "org-out-of-scope" : "legacy-fallback-denied"
  };
}

/**
 * @deprecated Runtime query permissions should use transformSelectQueryAstWithPermission()
 * and let the query compiler render SQL from AST.
 */
export function buildRowLevelFilter(context: PermissionContext): PermissionFilter {
  return buildDataScopeFilter(
    {
      scope: context.roles.includes("SUPER_ADMIN") ? "TENANT_ALL" : "SELF",
      allowedOrgIds: [],
      tenantAll: context.roles.includes("SUPER_ADMIN"),
      legacyFallbackToCreatedBy: true,
      reason: context.roles.includes("SUPER_ADMIN") ? "scope:TENANT_ALL" : "scope:SELF"
    },
    context
  );
}

/**
 * @deprecated SQL clause injection is retained only for legacy callers. Runtime
 * query execution must use Permission AST Transform instead.
 */
export function injectPermissionClause(baseSql: string, filter: PermissionFilter): string {
  if (filter.clause === "1=1") {
    return baseSql;
  }
  const limitMatch = /\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?\s*$/i.exec(baseSql);
  const tail = limitMatch ? limitMatch[0] : "";
  const sqlWithoutTail = limitMatch ? baseSql.slice(0, baseSql.length - tail.length) : baseSql;
  const upper = baseSql.toUpperCase();
  if (upper.includes(" WHERE ")) {
    return `${sqlWithoutTail} AND ${filter.clause}${tail}`;
  }
  return `${sqlWithoutTail} WHERE ${filter.clause}${tail}`;
}
