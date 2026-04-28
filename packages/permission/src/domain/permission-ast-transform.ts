import type { QueryFieldRef, QueryPredicate, SelectQueryAst } from "@zhongmiao/meta-lc-query";
import type {
  OrgScopeContext,
  PermissionAstTransformContext,
  PermissionContext
} from "../core/interfaces";
import { resolveDataScope } from "./permission-engine";

export function transformSelectQueryAstWithPermission(
  ast: SelectQueryAst,
  context: PermissionAstTransformContext
): SelectQueryAst {
  const permissionPredicate = buildPermissionPredicate(ast, context);

  return {
    ...ast,
    fields: ast.fields.map((field) => ({ ...field })),
    table: { ...ast.table },
    where: mergeWhere(ast.where, permissionPredicate)
  };
}

function buildPermissionPredicate(
  ast: SelectQueryAst,
  context: PermissionAstTransformContext
): QueryPredicate {
  const decision = context.dataScopeDecision ?? resolveDataScope(context.orgScope ?? createOrgScopeContext(context));
  const tableAlias = ast.table.alias;

  if (decision.tenantAll) {
    return tenantPredicate(context.tenantId, tableAlias);
  }

  if (decision.scope === "SELF") {
    return andPredicate([
      tenantPredicate(context.tenantId, tableAlias),
      comparisonPredicate("created_by", context.userId, tableAlias)
    ]);
  }

  if (!decision.allowedOrgIds.length) {
    return literalPredicate(false);
  }

  const orgScopePredicate = inPredicate("org_id", decision.allowedOrgIds, tableAlias);
  if (!decision.legacyFallbackToCreatedBy) {
    return andPredicate([tenantPredicate(context.tenantId, tableAlias), orgScopePredicate]);
  }

  return andPredicate([
    tenantPredicate(context.tenantId, tableAlias),
    {
      type: "logical",
      operator: "or",
      predicates: [
        orgScopePredicate,
        andPredicate([
          {
            type: "is_null",
            left: fieldRef("org_id", tableAlias)
          },
          comparisonPredicate("created_by", context.userId, tableAlias)
        ])
      ]
    }
  ]);
}

function createOrgScopeContext(context: PermissionContext): OrgScopeContext {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    roles: [...context.roles],
    userOrgIds: [],
    rolePolicies: [],
    orgNodes: []
  };
}

function mergeWhere(existing: QueryPredicate | undefined, permission: QueryPredicate): QueryPredicate {
  if (!existing) {
    return permission;
  }
  return andPredicate([existing, permission]);
}

function tenantPredicate(tenantId: string, tableAlias: string | undefined): QueryPredicate {
  return comparisonPredicate("tenant_id", tenantId, tableAlias);
}

function comparisonPredicate(
  field: string,
  value: string,
  tableAlias: string | undefined
): QueryPredicate {
  return {
    type: "comparison",
    left: fieldRef(field, tableAlias),
    operator: "eq",
    value
  };
}

function inPredicate(field: string, values: string[], tableAlias: string | undefined): QueryPredicate {
  return {
    type: "in",
    left: fieldRef(field, tableAlias),
    values: [...values]
  };
}

function literalPredicate(value: boolean): QueryPredicate {
  return {
    type: "literal",
    value
  };
}

function andPredicate(predicates: QueryPredicate[]): QueryPredicate {
  return {
    type: "logical",
    operator: "and",
    predicates
  };
}

function fieldRef(name: string, tableAlias: string | undefined): QueryFieldRef {
  return {
    name,
    ...(tableAlias ? { tableAlias } : {})
  };
}
