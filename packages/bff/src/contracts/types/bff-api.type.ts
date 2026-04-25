export type {
  DataScopeDecision,
  DataScopeType,
  OrgScopeContext
} from "@zhongmiao/meta-lc-permission";
export type { MutationOperation } from "@zhongmiao/meta-lc-runtime";

export type BootstrapMode = "auto" | "manual";

export type DbConfig = {
  url?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

export type DbTargets = {
  meta: DbConfig;
  business: DbConfig;
  audit: DbConfig;
};
