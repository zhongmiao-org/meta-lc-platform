CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'web',
  priority TEXT NOT NULL DEFAULT 'medium',
  amount INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_created_by
  ON orders (tenant_id, created_by);
