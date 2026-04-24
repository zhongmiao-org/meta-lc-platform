export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface QueryResultRow {
  [key: string]: unknown;
}
