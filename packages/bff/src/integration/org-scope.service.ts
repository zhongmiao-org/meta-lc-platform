import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { OrgNode, OrgScopeContext, RoleDataPolicy } from "@meta-lc/contracts";
import { Pool } from "pg";
import { loadDbConfig } from "../config";

interface RolePolicyRow {
  role_code: string;
  data_scope: string;
  custom_org_ids: string[] | null;
}

interface OrgNodeRow {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  path: string;
  name: string;
  type: string;
}

@Injectable()
export class OrgScopeService implements OnModuleDestroy {
  private readonly logger = new Logger("OrgScopeService");
  private readonly pool: Pool;

  constructor() {
    const config = loadDbConfig();
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  async resolveContext(input: {
    tenantId: string;
    userId: string;
    roles: string[];
  }): Promise<OrgScopeContext> {
    try {
      const [orgIds, rolePolicies, roleBindings, orgNodes] = await Promise.all([
        this.loadUserOrgIds(input.tenantId, input.userId),
        this.loadRolePolicies(input.tenantId),
        this.loadUserRoleBindings(input.tenantId, input.userId),
        this.loadOrgNodes(input.tenantId)
      ]);

      const mergedRoles = Array.from(new Set([...input.roles, ...roleBindings]));

      return {
        tenantId: input.tenantId,
        userId: input.userId,
        roles: mergedRoles,
        userOrgIds: orgIds,
        rolePolicies: rolePolicies.filter((policy) => mergedRoles.includes(policy.role)),
        orgNodes
      };
    } catch (error) {
      const code = String((error as { code?: string })?.code ?? "");
      if (code === "42P01") {
        this.logger.warn("org scope tables not ready, falling back to request roles only");
        return {
          tenantId: input.tenantId,
          userId: input.userId,
          roles: input.roles,
          userOrgIds: [],
          rolePolicies: [],
          orgNodes: []
        };
      }
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async loadUserOrgIds(tenantId: string, userId: string): Promise<string[]> {
    const result = await this.pool.query<{ org_id: string }>(
      `SELECT org_id
       FROM user_org_memberships
       WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId]
    );
    return result.rows.map((row) => row.org_id);
  }

  private async loadRolePolicies(tenantId: string): Promise<RoleDataPolicy[]> {
    const result = await this.pool.query<RolePolicyRow>(
      `SELECT role_code, data_scope, custom_org_ids
       FROM role_data_policies
       WHERE tenant_id = $1`,
      [tenantId]
    );

    return result.rows.map((row) => ({
      role: row.role_code,
      scope: normalizeScope(row.data_scope),
      customOrgIds: row.custom_org_ids ?? []
    }));
  }

  private async loadUserRoleBindings(tenantId: string, userId: string): Promise<string[]> {
    const result = await this.pool.query<{ role_code: string }>(
      `SELECT role_code
       FROM user_role_bindings
       WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId]
    );
    return result.rows.map((row) => row.role_code);
  }

  private async loadOrgNodes(tenantId: string): Promise<OrgNode[]> {
    const result = await this.pool.query<OrgNodeRow>(
      `SELECT id, tenant_id, parent_id, path, name, type
       FROM org_nodes
       WHERE tenant_id = $1`,
      [tenantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      parentId: row.parent_id,
      path: row.path,
      name: row.name,
      type: row.type
    }));
  }
}

function normalizeScope(value: string): RoleDataPolicy["scope"] {
  const normalized = value.toUpperCase();
  if (
    normalized === "SELF" ||
    normalized === "DEPT" ||
    normalized === "DEPT_AND_CHILDREN" ||
    normalized === "CUSTOM_ORG_SET" ||
    normalized === "TENANT_ALL"
  ) {
    return normalized;
  }
  return "SELF";
}
