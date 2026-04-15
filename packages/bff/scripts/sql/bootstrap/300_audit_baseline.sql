CREATE TABLE IF NOT EXISTS query_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  table_name TEXT NULL,
  query_dsl TEXT NULL,
  final_sql TEXT NULL,
  duration_ms INTEGER NOT NULL,
  result_count INTEGER NULL,
  status TEXT NOT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mutation_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  before_data JSONB NULL,
  after_data JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  version TEXT NOT NULL,
  migration_dsl JSONB NOT NULL,
  status TEXT NOT NULL,
  executed_sql TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ip TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bff_query_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  row_count INTEGER NULL,
  status TEXT NOT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_logs_request_id
  ON query_logs (request_id);

CREATE INDEX IF NOT EXISTS idx_bff_query_audit_logs_request_id
  ON bff_query_audit_logs (request_id);
