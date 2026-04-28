export interface PostgresOrgScopeInput {
  tenantId: string;
  userId: string;
}

export interface PostgresRoleDataPolicyRow {
  role: string;
  scope: string;
  customOrgIds: string[];
}

export interface PostgresOrgNodeRow {
  id: string;
  tenantId: string;
  parentId: string | null;
  path: string;
  name: string;
  type: string;
}

export interface PostgresOrgScopeData {
  userOrgIds: string[];
  rolePolicies: PostgresRoleDataPolicyRow[];
  roleBindings: string[];
  orgNodes: PostgresOrgNodeRow[];
}
