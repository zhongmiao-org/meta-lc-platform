import { startBffServer } from "../../packages/bff/dist/index.js";
import { executeRuntimeGatewayView } from "../../packages/runtime/dist/index.js";
import {
  createPostgresDatasourceAdapter,
  createPostgresOrgScopeResolver,
  type DbConfig,
  type PostgresOrgScopeData
} from "@zhongmiao/meta-lc-datasource";
import type { OrgNode, OrgScopeContext, RoleDataPolicy } from "@zhongmiao/meta-lc-permission";
import { OrdersDemoMutationAdapter } from "./datasource-adapters.ts";
import {
  ORDERS_DEMO_APP_ID,
  createOrdersDemoMetaKernel,
  createOrdersDemoMetaRegistryProvider
} from "./meta-registry.ts";

const metaKernel = createOrdersDemoMetaKernel();

type RuntimeGatewayRunner = NonNullable<Parameters<typeof startBffServer>[0]["runtimeRunner"]>;

const runtimeRunner: RuntimeGatewayRunner = async (viewName, request) => {
  const businessDbConfig = loadBusinessDbConfig();
  const queryDatasource = createPostgresDatasourceAdapter(businessDbConfig);
  const orgScopeDataResolver = createPostgresOrgScopeResolver(businessDbConfig);
  const mutationDatasource = new OrdersDemoMutationAdapter(businessDbConfig);
  try {
    return await executeRuntimeGatewayView(viewName, request, {
      appId: ORDERS_DEMO_APP_ID,
      metaKernel,
      queryDatasource,
      mutationDatasource,
      orgScopeResolver: {
        async resolve(input) {
          try {
            return mapOrgScopeData(input, await orgScopeDataResolver.resolve(input));
          } catch (error) {
            if (getPgErrorCode(error) === "42P01") {
              return createEmptyOrgScope(input);
            }
            throw error;
          }
        }
      }
    });
  } finally {
    await Promise.all([
      queryDatasource.close?.(),
      orgScopeDataResolver.close?.(),
      mutationDatasource.close()
    ]);
  }
};

async function main(): Promise<void> {
  await startBffServer({
    runtimeRunner,
    metaRegistry: createOrdersDemoMetaRegistryProvider()
  });
}

function loadBusinessDbConfig(): DbConfig {
  const url = process.env.LC_DB_BUSINESS_URL;
  if (url) {
    return parseDbUrl(url);
  }
  return {
    host: readRequiredEnv("LC_DB_HOST"),
    port: readPort(process.env.LC_DB_PORT, 5432),
    user: readRequiredEnv("LC_DB_USER"),
    password: readRequiredEnv("LC_DB_PASSWORD"),
    database: process.env.LC_DB_BUSINESS_NAME ?? process.env.LC_DB_NAME ?? "business_db",
    ssl: (process.env.LC_DB_SSL ?? "false").toLowerCase() === "true"
  };
}

function parseDbUrl(value: string): DbConfig {
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`Unsupported database url protocol: ${url.protocol}`);
  }
  return {
    url: value,
    host: url.hostname,
    port: Number(url.port || "5432"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: (url.searchParams.get("sslmode") ?? "").toLowerCase() === "require"
  };
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapOrgScopeData(
  input: { tenantId: string; userId: string; roles: string[] },
  data: PostgresOrgScopeData
): OrgScopeContext {
  const roles = Array.from(new Set([...input.roles, ...data.roleBindings]));
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    roles,
    userOrgIds: data.userOrgIds,
    rolePolicies: data.rolePolicies
      .filter((policy) => roles.includes(policy.role))
      .map<RoleDataPolicy>((policy) => ({
        role: policy.role,
        scope: normalizeScope(policy.scope),
        customOrgIds: policy.customOrgIds
      })),
    orgNodes: data.orgNodes.map<OrgNode>((node) => ({
      id: node.id,
      tenantId: node.tenantId,
      parentId: node.parentId,
      path: node.path,
      name: node.name,
      type: node.type
    }))
  };
}

function createEmptyOrgScope(input: { tenantId: string; userId: string; roles: string[] }): OrgScopeContext {
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    roles: input.roles,
    userOrgIds: [],
    rolePolicies: [],
    orgNodes: []
  };
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

function getPgErrorCode(error: unknown): string {
  return String((error as { code?: string })?.code ?? "");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
