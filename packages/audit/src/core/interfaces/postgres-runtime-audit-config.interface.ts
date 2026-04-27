export interface PostgresRuntimeAuditConfig {
  url?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}
