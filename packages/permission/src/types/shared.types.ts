export type {
  DataScopeDecision,
  DataScopeType,
  OrgNode,
  OrgScopeContext,
  RoleDataPolicy
} from "@zhongmiao/meta-lc-contracts";

export interface PermissionContext {
  tenantId: string;
  userId: string;
  roles: string[];
}

export interface PermissionFilter {
  clause: string;
  params: Array<string | number | boolean | string[]>;
}
