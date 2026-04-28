English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

## 0.2.0 (2026-04-28)

- chore(public-api): narrow the package root to core contracts and explicit query compiler entrypoints.
- docs(readme): clarify query upstream/downstream relationships and AST-to-SQL compiler-only boundaries.
- chore(boundaries): add final Nx layer tags and lock query as a dependency-free AST/SQL compiler package.
- docs(boundary): document runtime-owned query node contracts after package topology convergence.
- feat(query-ast): support permission predicate shapes such as `IN`, `IS NULL`, and boolean literals.
- feat(query-ast): add AST-first select query builder and SQL compiler while keeping the legacy request entrypoint.
- refactor(package-structure): reorganize src into layered domain/application/infra/interface/types/utils directories and update public entrypoints.
- docs(readme): add bilingual package README and minimal architecture flow.
- chore(package): adopt the `@zhongmiao/meta-lc-query` scoped package identity for release governance.

## 0.1.0 (2026-04-18)

- Initial query compiler baseline for platform middleware.
