import { startBffServer } from "../../packages/bff/dist/bff/src/index.js";
import { executeRuntimeGatewayView } from "../../packages/runtime/dist/runtime/src/index.js";
import type { DbConfig } from "@zhongmiao/meta-lc-datasource";
import { OrdersDemoMutationAdapter } from "./datasource-adapters.ts";
import {
  ORDERS_DEMO_APP_ID,
  createOrdersDemoMetaKernel,
  createOrdersDemoMetaRegistryProvider
} from "./meta-registry.ts";

const metaKernel = createOrdersDemoMetaKernel();

type RuntimeGatewayRunner = NonNullable<Parameters<typeof startBffServer>[0]["runtimeRunner"]>;

const runtimeRunner: RuntimeGatewayRunner = async (viewName, request) => {
  const mutationDatasource = new OrdersDemoMutationAdapter(loadBusinessDbConfig());
  try {
    return await executeRuntimeGatewayView(viewName, request, {
      appId: ORDERS_DEMO_APP_ID,
      metaKernel,
      mutationDatasource,
      businessDbConfig: loadBusinessDbConfig()
    });
  } finally {
    await mutationDatasource.close();
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

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
