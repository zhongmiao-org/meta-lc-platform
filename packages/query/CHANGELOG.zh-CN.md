[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- docs(boundary): 包拓扑收敛后，文档明确 query node contract 由 runtime 拥有。
- feat(query-ast): 支持 `IN`、`IS NULL` 与 boolean literal 等权限 predicate 形状。
- feat(query-ast): 新增 AST-first select query builder 与 SQL compiler，同时保留旧 request 入口兼容。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-query` 正式包名。

## 0.1.0 (2026-04-18)

- 平台中间件查询编译器的首个基线版本。
