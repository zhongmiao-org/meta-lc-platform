import { Pool } from "pg";
import type { DbConfig } from "../../core/interfaces";

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

export class PostgresOrgScopeAdapter {
  private readonly pool: Pool;

  constructor(config: DbConfig, pool?: Pool) {
    this.pool = pool ?? createPool(config);
  }

  async resolve(input: PostgresOrgScopeInput): Promise<PostgresOrgScopeData> {
    const [userOrgIds, rolePolicies, roleBindings, orgNodes] = await Promise.all([
      this.loadUserOrgIds(input.tenantId, input.userId),
      this.loadRolePolicies(input.tenantId),
      this.loadUserRoleBindings(input.tenantId, input.userId),
      this.loadOrgNodes(input.tenantId)
    ]);

    return {
      userOrgIds,
      rolePolicies,
      roleBindings,
      orgNodes
    };
  }

  async close(): Promise<void> {
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

  private async loadRolePolicies(tenantId: string): Promise<PostgresRoleDataPolicyRow[]> {
    const result = await this.pool.query<{
      role_code: string;
      data_scope: string;
      custom_org_ids: string[] | null;
    }>(
      `SELECT role_code, data_scope, custom_org_ids
       FROM role_data_policies
       WHERE tenant_id = $1`,
      [tenantId]
    );

    return result.rows.map((row) => ({
      role: row.role_code,
      scope: row.data_scope,
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

  private async loadOrgNodes(tenantId: string): Promise<PostgresOrgNodeRow[]> {
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      parent_id: string | null;
      path: string;
      name: string;
      type: string;
    }>(
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

function createPool(config: DbConfig): Pool {
  if (config.url) {
    return new Pool({
      connectionString: config.url,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  return new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });
}
