CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  channel TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  org_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders (owner);

INSERT INTO orders (id, owner, channel, priority, status, tenant_id, created_by, org_id)
VALUES
  ('SO-A1001', 'Alice', 'web', 'high', 'active', 'tenant-a', 'demo-tenant-a-user', 'dept-a'),
  ('SO-A1002', 'Aria', 'store', 'medium', 'paused', 'tenant-a', 'demo-tenant-a-user', 'dept-a'),
  ('SO-A2001', 'A-Manager-Only', 'partner', 'high', 'active', 'tenant-a', 'manager-tenant-a', 'dept-b'),
  ('SO-B1001', 'Brenda', 'partner', 'high', 'active', 'tenant-b', 'demo-tenant-b-user', 'dept-c'),
  ('SO-B1002', 'Bryan', 'web', 'low', 'paused', 'tenant-b', 'demo-tenant-b-user', 'dept-c')
ON CONFLICT (id) DO UPDATE
SET
  owner = EXCLUDED.owner,
  channel = EXCLUDED.channel,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  tenant_id = EXCLUDED.tenant_id,
  created_by = EXCLUDED.created_by,
  org_id = EXCLUDED.org_id;
