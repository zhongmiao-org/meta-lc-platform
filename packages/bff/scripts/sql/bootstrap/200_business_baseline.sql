CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  org_id TEXT NULL,
  channel TEXT NOT NULL DEFAULT 'web',
  priority TEXT NOT NULL DEFAULT 'medium',
  amount INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS org_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tenant_created_by
  ON orders (tenant_id, created_by);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_org
  ON orders (tenant_id, org_id);

CREATE TABLE IF NOT EXISTS org_nodes (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  parent_id TEXT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'department',
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_org_nodes_tenant_path
  ON org_nodes (tenant_id, path);

CREATE TABLE IF NOT EXISTS user_org_memberships (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  position TEXT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_user_org_memberships_tenant_user
  ON user_org_memberships (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS role_data_policies (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  role_code TEXT NOT NULL,
  data_scope TEXT NOT NULL,
  custom_org_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role_code)
);

CREATE TABLE IF NOT EXISTS user_role_bindings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, role_code)
);

INSERT INTO org_nodes (id, tenant_id, parent_id, path, name, type)
VALUES
  ('mgr-1', 'tenant-a', NULL, 'mgr-1', '经理1', 'manager'),
  ('dept-a', 'tenant-a', 'mgr-1', 'mgr-1/dept-a', '部门A', 'department'),
  ('dept-b', 'tenant-a', 'mgr-1', 'mgr-1/dept-b', '部门B', 'department'),
  ('mgr-2', 'tenant-b', NULL, 'mgr-2', '经理2', 'manager'),
  ('dept-c', 'tenant-b', 'mgr-2', 'mgr-2/dept-c', '部门C', 'department')
ON CONFLICT (tenant_id, id) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    path = EXCLUDED.path,
    name = EXCLUDED.name,
    type = EXCLUDED.type;

INSERT INTO role_data_policies (tenant_id, role_code, data_scope, custom_org_ids)
VALUES
  ('tenant-a', 'MANAGER', 'DEPT_AND_CHILDREN', '{}'),
  ('tenant-a', 'USER', 'DEPT', '{}'),
  ('tenant-a', 'CUSTOM_SUPPORT', 'CUSTOM_ORG_SET', '{"dept-b"}'),
  ('tenant-a', 'SUPER_ADMIN', 'TENANT_ALL', '{}'),
  ('tenant-b', 'MANAGER', 'DEPT_AND_CHILDREN', '{}'),
  ('tenant-b', 'USER', 'DEPT', '{}'),
  ('tenant-b', 'SUPER_ADMIN', 'TENANT_ALL', '{}')
ON CONFLICT (tenant_id, role_code) DO UPDATE
SET data_scope = EXCLUDED.data_scope,
    custom_org_ids = EXCLUDED.custom_org_ids;

INSERT INTO user_org_memberships (tenant_id, user_id, org_id, position, is_primary)
VALUES
  ('tenant-a', 'demo-tenant-a-user', 'dept-a', 'staff', true),
  ('tenant-a', 'manager-tenant-a', 'mgr-1', 'manager', true),
  ('tenant-a', 'custom-tenant-a-user', 'dept-a', 'staff', true),
  ('tenant-a', 'self-tenant-a-user', 'dept-a', 'staff', true),
  ('tenant-b', 'demo-tenant-b-user', 'dept-c', 'staff', true)
ON CONFLICT (tenant_id, user_id, org_id) DO UPDATE
SET position = EXCLUDED.position,
    is_primary = EXCLUDED.is_primary;

INSERT INTO user_role_bindings (tenant_id, user_id, role_code)
VALUES
  ('tenant-a', 'demo-tenant-a-user', 'USER'),
  ('tenant-a', 'manager-tenant-a', 'MANAGER'),
  ('tenant-a', 'custom-tenant-a-user', 'CUSTOM_SUPPORT'),
  ('tenant-b', 'demo-tenant-b-user', 'USER')
ON CONFLICT (tenant_id, user_id, role_code) DO NOTHING;
