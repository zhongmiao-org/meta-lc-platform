export interface PermissionContext {
  tenantId: string;
  userId: string;
  roles: string[];
}

export interface PermissionFilter {
  clause: string;
  params: Array<string | number | boolean | string[]>;
}

export type DataScopeType =
  | "SELF"
  | "DEPT"
  | "DEPT_AND_CHILDREN"
  | "CUSTOM_ORG_SET"
  | "TENANT_ALL";

export interface RoleDataPolicy {
  role: string;
  scope: DataScopeType;
  customOrgIds?: string[];
}

export interface OrgNode {
  id: string;
  tenantId: string;
  parentId: string | null;
  path: string;
  name: string;
  type: string;
}

export interface OrgScopeContext {
  tenantId: string;
  userId: string;
  roles: string[];
  userOrgIds: string[];
  rolePolicies: RoleDataPolicy[];
  orgNodes: OrgNode[];
}

export interface DataScopeDecision {
  scope: DataScopeType;
  allowedOrgIds: string[];
  tenantAll: boolean;
  legacyFallbackToCreatedBy: boolean;
  reason: string;
}
