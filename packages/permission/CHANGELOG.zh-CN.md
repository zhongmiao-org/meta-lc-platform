[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- chore(public-api): 将 package root 收窄为 core contract 与明确的 permission engine 入口。
- docs(readme): 明确 permission 上下游关系与仅 type-only 依赖 query AST/types 的边界。
- fix(ci): 在 clean runner 的 permission package-local test 前先构建 query。
- chore(boundaries): 新增最终 Nx layer tags，并将 permission 锁定为只能依赖 query。
- refactor(contracts): 由 permission 直接拥有组织与数据域 DTO contract。
- feat(permission-ast): 新增覆盖 tenant、self 与组织数据域的 Query AST transform。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-permission` 正式包名。

## 0.1.0 (2026-04-18)

- 租户、角色与组织域权限执行链的首个基线版本。
