English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- chore(public-api): narrow the package root to core contracts and explicit kernel service, generator, and migration safety APIs.
- refactor(meta): remove orders demo registry seeds from kernel and move example-owned metadata to `examples/orders-demo`.
- docs(readme): add kernel upstream/downstream notes for metadata ownership and meta_db persistence.
- fix(package): align the kernel package main/types entrypoints with the dependency-free clean build output.
- chore(boundaries): own `DataScopeType` as a local structural literal and remove the permission package dependency so kernel has no workspace dependencies.
- refactor(contracts): own ViewDefinition and node structure contracts directly while staying independent from runtime.
- refactor(contracts): own datasource, permission policy, view, and node structure contracts directly.
- feat(meta-registry): add versioned view, datasource, and permission policy definition registry APIs.
- refactor(package-structure): reorganize src into layered domain/application/infra/interface/types/utils directories and update public entrypoints.
- docs(readme): add bilingual package README and minimal architecture flow.
- chore(package): adopt the `@zhongmiao/meta-lc-kernel` scoped package identity for release governance.
- feat(sql-generator): add table, index, relation SQL generation and a compiler fixture baseline.
- test(compiler): add a reusable compiler contract fixture for SQL generator output.
- feat(api-generator): add a stable route manifest generator and extend compiler fixture coverage to API outputs.
- feat(permission-generator): add a stable permission manifest generator and complete compiler fixture coverage.
- feat(schema): add tenant, app, rule, and permission metadata to the versioned MetaSchema contract.

## 0.1.0 (2026-04-18)

- Initial kernel baseline for snapshot, diff, and migration DSL source of truth.
