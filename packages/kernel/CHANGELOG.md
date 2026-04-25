English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- refactor(meta): own the demo meta registry seeds used by runtime gateway view lookup.
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
