English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- chore(boundaries): add final Nx layer tags and lock permission so it can depend on query only.
- refactor(contracts): own org and data-scope DTO contracts directly.
- feat(permission-ast): add Query AST transforms for tenant, self, and organization data scopes.
- refactor(package-structure): reorganize src into layered domain/application/infra/interface/types/utils directories and update public entrypoints.
- docs(readme): add bilingual package README and minimal architecture flow.
- chore(package): adopt the `@zhongmiao/meta-lc-permission` scoped package identity for release governance.

## 0.1.0 (2026-04-18)

- Initial permission baseline for tenant, role, and org-scope enforcement.
