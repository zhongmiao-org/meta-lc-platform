# meta-lc-platform

Core monorepo for Meta-Driven lowcode middleware.

This workspace combines reusable platform libraries under `packages/*` with a runnable middleware service entry under `apps/bff-server`.

## Structure

- `packages/platform`: aggregate package entry for `@zhongmiao/meta-lc-platform`
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
pnpm --filter @zhongmiao/meta-lc-bff-server start
pnpm infra:up
pnpm infra:query-gate
```

## Architectural constraints

- No deep cross-package imports (entrypoint imports only).
- DB driver access is restricted and being converged to datasource package.
- Kernel cannot depend on bff/query/datasource implementations.
- Frontend must use middleware (`lowcode -> middleware -> backend`).

## Release Governance

- Publishable library identities use the `@zhongmiao/meta-lc-*` scope.
- `@zhongmiao/meta-lc-platform` is the aggregate library entry and does not package the runnable BFF program.
- Root changelogs record platform/runtime/service changes; package changelogs record package-local API and behavior changes.
