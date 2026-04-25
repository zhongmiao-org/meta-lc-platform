import type { RoleDataPolicy } from "@zhongmiao/meta-lc-permission";

export type RolePolicyRow = {
  role_code: string;
  data_scope: string;
  custom_org_ids: string[] | null;
};

export type OrgNodeRow = {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  path: string;
  name: string;
  type: string;
};

export type NormalizedDataScope = RoleDataPolicy["scope"];
