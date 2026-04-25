# @zhongmiao/meta-lc-kernel

English | [中文文档](./README_zh.md)

## Package Role

`kernel` is the structural metadata source for the platform. It owns MetaSchema, ViewDefinition, NodeDefinition, DatasourceDefinition, PermissionPolicy, schema validation, snapshot and migration DSL helpers, schema diff, SQL generation, version publishing, rollback, migration audit persistence, and the versioned meta definition registry.

## Responsibilities

- Define table, field, relation, index, tenant, app, rule, and permission schema types.
- Validate schemas before they are published.
- Persist and retrieve versioned schemas through the Postgres repository.
- Publish, retrieve, and diff versioned view, datasource, and permission policy definitions.
- Generate schema SQL, migration SQL, API route manifests, and permission manifests.
- Guard destructive migration statements and record migration audits.

## Relationship With Other Packages

- Migration lifecycle scripts reuse kernel migration compile and safety helpers from infra.
- `bff` reads kernel registry definitions as a thin gateway and must not orchestrate metadata.
- `query`, `permission`, and `datasource` must not become kernel dependencies.
- Kernel owns structure contracts; runtime consumes view/node definitions and owns only execution contracts.

## Minimal Flow

```mermaid
flowchart LR
  Schema["MetaSchema"] --> Validate["validateSchema"]
  Validate --> Publish["publishSchema"]
  Publish --> Version["meta_kernel_versions"]
  Definition["View / Datasource / Policy"] --> Registry["meta definition registry"]
  Version --> Diff["diff / buildMigrationPlan"]
  Diff --> Sql["migration SQL + safety report"]
```

## Commands

```bash
pnpm --filter @zhongmiao/meta-lc-kernel build
pnpm --filter @zhongmiao/meta-lc-kernel test
```

## Boundary Notes

- Kernel is the metadata source of truth and must stay independent from BFF orchestration.
- DB access here is limited to meta-kernel persistence and migration audit responsibilities.
- Do not add HTTP, NestJS controller, runtime UI, or business execution logic here.
- Do not execute runtime plans from meta registry APIs; registry only versions definitions.
