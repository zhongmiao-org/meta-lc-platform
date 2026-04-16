CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  channel TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders (owner);

INSERT INTO orders (id, owner, channel, priority, status, tenant_id, created_by)
VALUES
  ('SO-A1001', 'Alice', 'web', 'high', 'active', 'tenant-a', 'demo-tenant-a-user'),
  ('SO-A1002', 'Aria', 'store', 'medium', 'paused', 'tenant-a', 'demo-tenant-a-user'),
  ('SO-B1001', 'Brenda', 'partner', 'high', 'active', 'tenant-b', 'demo-tenant-b-user'),
  ('SO-B1002', 'Bryan', 'web', 'low', 'paused', 'tenant-b', 'demo-tenant-b-user')
ON CONFLICT (id) DO UPDATE
SET
  owner = EXCLUDED.owner,
  channel = EXCLUDED.channel,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  tenant_id = EXCLUDED.tenant_id,
  created_by = EXCLUDED.created_by;
