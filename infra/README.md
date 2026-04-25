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
- tenant isolation through `POST /view/:name`
- runtime query, permission, datasource, and audit boundaries through the runtime facade

## Run migrations and seed data

```bash
pnpm infra:migrate meta
pnpm infra:migrate business
pnpm infra:migrate audit
pnpm infra:seed
```

These scripts are infra-only operational entrypoints. They read SQL from `infra/sql/bootstrap` and do not run through the BFF package.

## Defaults

- `PORT=6001`
- databases: `meta_db`, `business_db`, `audit_db`
