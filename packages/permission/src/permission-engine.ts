import type { PermissionContext, PermissionFilter } from "./types";

export function buildRowLevelFilter(context: PermissionContext): PermissionFilter {
  const hasAdminRole = context.roles.includes("SUPER_ADMIN");
  if (hasAdminRole) {
    return {
      clause: "1=1",
      params: []
    };
  }

  return {
    clause: "tenant_id = $1 AND created_by = $2",
    params: [context.tenantId, context.userId]
  };
}

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
