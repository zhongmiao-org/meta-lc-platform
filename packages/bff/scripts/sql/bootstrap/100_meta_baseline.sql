CREATE TABLE IF NOT EXISTS meta_kernel_versions (
  id BIGSERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  schema_json JSONB NOT NULL,
  metadata_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (app_id, version)
);

CREATE TABLE IF NOT EXISTS meta_kernel_migration_audits (
  id BIGSERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  from_version INTEGER NOT NULL,
  to_version INTEGER NOT NULL,
  statement TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT NULL,
  duration_ms INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_kernel_migration_audits_request_id
  ON meta_kernel_migration_audits (request_id);

CREATE INDEX IF NOT EXISTS idx_meta_kernel_migration_audits_app_created
  ON meta_kernel_migration_audits (app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meta_shadow_tables (
  id BIGSERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (app_id, table_name)
);

CREATE TABLE IF NOT EXISTS meta_shadow_fields (
  id BIGSERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  nullable BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (app_id, table_name, field_name)
);
