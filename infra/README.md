# Infra (meta-lc-platform)

`meta-lc-platform/infra` is the only infra entry for local middleware integration.

## Bring up dependencies

```bash
cd ./meta-lc-platform
docker compose -f infra/docker-compose.yml up -d postgres redis
```

or

```bash
cd ./meta-lc-platform
bash infra/scripts/up.sh
```

## Run query gate

```bash
cd ./meta-lc-platform
bash infra/scripts/query-gate.sh
```

The gate validates:

- BFF startup via `apps/bff-server`
- tenant isolation on `/query`
- query/mutation audit persistence in `audit_db`

## Defaults

- `PORT=6001`
- `LC_DB_BOOTSTRAP_MODE=auto` (dev/test)
- databases: `meta_db`, `business_db`, `audit_db`
