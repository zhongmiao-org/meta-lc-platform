English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- chore(package): adopt the `@zhongmiao/meta-lc-kernel` scoped package identity for release governance.
- feat(sql-generator): add table, index, relation SQL generation and a compiler fixture baseline.
- test(compiler): add a reusable compiler contract fixture for SQL generator output.
- feat(api-generator): add a stable route manifest generator and extend compiler fixture coverage to API outputs.
- feat(permission-generator): add a stable permission manifest generator and complete compiler fixture coverage.
- feat(schema): add tenant, app, rule, and permission metadata to the versioned MetaSchema contract.

## 0.1.0 (2026-04-18)

- Initial kernel baseline for snapshot, diff, and migration DSL source of truth.
