English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- chore(boundaries): add final Nx layer tags and lock audit as a passive package without workspace dependencies.
- feat(sink): add an optional Postgres runtime audit sink that degrades without blocking runtime execution.
- refactor(contracts): own QueryAuditLog and audit status contracts directly.
- feat(observability): add non-blocking runtime audit event contracts for plan, node, permission, and datasource execution.
- refactor(package-structure): reorganize src into layered domain/application/infra/interface/types/utils directories and update public entrypoints.
- docs(readme): add bilingual package README and minimal architecture flow.
- chore(package): adopt the `@zhongmiao/meta-lc-audit` scoped package identity for release governance.

## 0.1.0 (2026-04-18)

- Initial audit persistence baseline for query, mutation, migration, and access logs.
