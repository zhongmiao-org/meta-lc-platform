English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- chore(boundaries): add final Nx layer tags and lock datasource against workspace package dependencies.
- chore(boundaries): rename Postgres demo runtime adapters to make demo-orders and org-scope boundaries explicit.
- feat(adapter): add Postgres demo orders mutation and org-scope loaders so runtime owns execution wiring without BFF DB access.
- feat(adapter): add a stable datasource execution contract and Postgres adapter result normalization.
- refactor(package-structure): reorganize src into layered domain/application/infra/interface/types/utils directories and update public entrypoints.
- docs(readme): add bilingual package README and minimal architecture flow.
- chore(package): adopt the `@zhongmiao/meta-lc-datasource` scoped package identity for release governance.

## 0.1.0 (2026-04-18)

- Initial datasource execution adapter baseline for PostgreSQL-backed middleware flows.
