# SDK Release Checklist

This checklist is for the SDK beta freeze. Architecture-level package structure, public API boundaries, adapter layout, and the `runtime/core` exposure surface are considered sealed for this release pass.

## Freeze Decision / 封板结论

- The seven core packages plus adapter-package model is the frozen package topology.
- Package roots and approved secondary entries are the only SDK consumer import surfaces.
- Remaining cleanup is documentation and future test hygiene only.
- Concrete Postgres class exports remain available from approved `/postgres` entries as advanced API.
- Package-local test imports are not SDK consumer examples.

## Public API / Import Rules

- SDK consumers must import from package roots or approved secondary entries only.
- `@zhongmiao/meta-lc-runtime` is the runtime facade entry.
- `@zhongmiao/meta-lc-runtime/core` is the runtime contract, error, constant, and event entry.
- `@zhongmiao/meta-lc-datasource/postgres` and `@zhongmiao/meta-lc-audit/postgres` are the approved Postgres adapter entries.
- Business code must not deep import package internals such as package `src/*` subpaths, `domain/*`, `application/*`, `infra/*`, or concrete implementation file paths.

## Adapter Rules

- Postgres adapters are factory-first.
- Composition roots should prefer `createPostgresDatasourceAdapter`, `PostgresDatasourceAdapterFactory`, `createPostgresRuntimeAuditSink`, `PostgresRuntimeAuditSinkFactory`, and the kernel Postgres repository factory APIs.
- `PostgresDatasourceAdapter` and `PostgresRuntimeAuditSink` remain exported as advanced API for low-level integration and package-local tests.
- Application wiring should not directly `new PostgresDatasourceAdapter()` or `new PostgresRuntimeAuditSink()`.
- Postgres adapters may be wired only in apps, examples, composition roots, or infra scripts. Core packages and BFF must not wire concrete Postgres adapters.

## Test Import Policy / 测试导入策略

- Existing package-local tests may keep relative imports into `../src/domain` or `../src/postgres/*` for internal coverage.
- These imports are not SDK consumer examples and must not appear in business documentation.
- Future cleanup should prefer a package-local `test-api.ts` when internal test coverage needs a stable test-only surface.
- Adding `test-api.ts` must not widen package root exports or SDK public API.

## Release Gate / 发布门禁

Run the full freeze gate before tagging or publishing a beta:

```bash
pnpm run test:boundaries
pnpm run lint:boundaries
pnpm -r build
pnpm -r test
pnpm lint
pnpm query-gate
node scripts/check-changelog-gate.mjs "$(git merge-base origin/main HEAD)" HEAD
pnpm run version:check
```

Run the documentation spot check when this checklist or README guidance changes:

```bash
rg "factory-first|advanced API|deep import|@zhongmiao/meta-lc-runtime/core" README.md README_zh.md docs packages/*/README.md packages/*/README_zh.md
rg "@zhongmiao/meta-lc-[^\"']+/src/" README.md README_zh.md docs packages/*/README.md packages/*/README_zh.md
```

The second command should return no matches.

## Out of Scope / 本轮不做

- Do not further narrow `runtime/core`.
- Do not remove concrete adapter class exports from `/postgres` secondary entries.
- Do not restructure packages or add new secondary entries.
- Do not rewrite package-local tests that currently use internal relative imports.
