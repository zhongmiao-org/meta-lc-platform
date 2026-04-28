export const CREATE_META_KERNEL_VERSIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS meta_kernel_versions (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    schema_json JSONB NOT NULL,
    metadata_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, version)
  );
`;

export const CREATE_META_KERNEL_MIGRATION_AUDITS_TABLE_SQL = `
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
`;

export const CREATE_META_KERNEL_MIGRATION_AUDITS_REQUEST_ID_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_meta_kernel_migration_audits_request_id
  ON meta_kernel_migration_audits (request_id)
`;

export const CREATE_META_KERNEL_MIGRATION_AUDITS_APP_CREATED_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_meta_kernel_migration_audits_app_created
  ON meta_kernel_migration_audits (app_id, created_at DESC)
`;

export const CREATE_META_KERNEL_DEFINITION_VERSIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS meta_kernel_definition_versions (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    definition_kind TEXT NOT NULL,
    definition_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    definition_json JSONB NOT NULL,
    metadata_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, definition_kind, definition_id, version)
  );
`;

export const CREATE_META_KERNEL_DEFINITION_VERSIONS_LATEST_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_meta_kernel_definition_versions_latest
  ON meta_kernel_definition_versions (app_id, definition_kind, definition_id, version DESC)
`;

export const META_KERNEL_SCHEMA_SQL = [
  CREATE_META_KERNEL_VERSIONS_TABLE_SQL,
  CREATE_META_KERNEL_MIGRATION_AUDITS_TABLE_SQL,
  CREATE_META_KERNEL_MIGRATION_AUDITS_REQUEST_ID_INDEX_SQL,
  CREATE_META_KERNEL_MIGRATION_AUDITS_APP_CREATED_INDEX_SQL,
  CREATE_META_KERNEL_DEFINITION_VERSIONS_TABLE_SQL,
  CREATE_META_KERNEL_DEFINITION_VERSIONS_LATEST_INDEX_SQL
];
