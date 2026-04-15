export interface PermissionContext {
  tenantId: string;
  userId: string;
  roles: string[];
}

export interface PermissionFilter {
  clause: string;
  params: Array<string | number | boolean>;
}
