# meta-lc-platform

Core monorepo for Meta-Driven lowcode middleware.

## Structure

- `packages/kernel`: snapshot + migration DSL source of truth
- `packages/query`: query DSL to SQL compilation
- `packages/permission`: tenant/role permission injection
- `packages/datasource`: DB execution adapters
- `packages/migration`: migration DSL -> SQL compile/apply
- `packages/audit`: query/mutation/migration/access audit APIs
- `packages/contracts`: cross-package DTO/types
- `packages/shared`: shared helpers
- `packages/bff`: middleware orchestration module
- `apps/bff-server`: NestJS runtime entry

## Commands

```bash
pnpm install
pnpm -r build
pnpm -r test
pnpm lint
pnpm --filter @meta-lc/bff-server start
pnpm infra:up
pnpm infra:query-gate
```

## Architectural constraints

- No deep cross-package imports (entrypoint imports only).
- DB driver access is restricted and being converged to datasource package.
- Kernel cannot depend on bff/query/datasource implementations.
- Frontend must use middleware (`lowcode -> middleware -> backend`).
