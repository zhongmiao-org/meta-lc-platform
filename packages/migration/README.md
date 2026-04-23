# @zhongmiao/meta-lc-migration

English | [中文文档](./README_zh.md)

## Package Role

`migration` is a thin facade over kernel migration DSL compilation and migration safety checks. It provides compile and apply helpers without owning schema version storage.

## Responsibilities

- Compile `MigrationDslV1` into SQL bundles by delegating to kernel.
- Apply SQL statements through an injected executor.
- Enforce destructive statement checks before execution.
- Tag migration targets as `meta`, `business`, or `audit`.

## Relationship With Other Packages

- Depends on `kernel` for migration DSL types, SQL compilation, and safety checks.
- BFF or infrastructure code supplies the actual SQL executor.
- Does not own Postgres connection setup; execution remains injected.

## Minimal Flow

```mermaid
flowchart LR
  Dsl["MigrationDslV1"] --> Compile["compileToSql"]
  Compile --> Sql["up/down SQL"]
  Sql --> Safety["assertMigrationSafety"]
  Safety --> Apply["apply with injected executor"]
```

## Commands

```bash
pnpm --filter @zhongmiao/meta-lc-migration build
pnpm --filter @zhongmiao/meta-lc-migration test
```

## Boundary Notes

- Keep this package as orchestration glue, not a metadata repository.
- Do not bypass safety checks when applying statements.
