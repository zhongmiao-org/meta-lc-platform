English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- refactor(contracts): own QueryAuditLog and audit status contracts directly.
- feat(observability): add non-blocking runtime audit event contracts for plan, node, permission, and datasource execution.
- refactor(package-structure): reorganize src into layered domain/application/infra/interface/types/utils directories and update public entrypoints.
- docs(readme): add bilingual package README and minimal architecture flow.
- chore(package): adopt the `@zhongmiao/meta-lc-audit` scoped package identity for release governance.
- refactor(boundary): narrow the package back to audit contracts and compatibility helpers so audit DB execution stays inside the BFF boundary.

## 0.1.0 (2026-04-18)

- Initial audit persistence baseline for query, mutation, migration, and access logs.
