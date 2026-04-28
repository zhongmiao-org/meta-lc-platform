[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- chore(boundaries): 围绕 audit root 与 Postgres secondary entry 锁定 package exports 和 deep import 规则。
- chore(sdk): 移除空的 utils root export，并将 Postgres sink 入口使用的 `pg` 调整为可选 peer。
- refactor(public-api): 将 Postgres audit sink 移到 `@zhongmiao/meta-lc-audit/postgres` secondary entry。
- docs(readme): 补充最终架构协作流中的上下游关系说明。
- chore(boundaries): 新增最终 Nx layer tags，并将 audit 锁定为无 workspace 依赖的被动观测包。
- feat(sink): 新增可选 Postgres runtime audit sink，落盘失败不会阻断 runtime execution。
- refactor(contracts): 由 audit 直接拥有 QueryAuditLog 与 audit status contract。
- feat(observability): 新增面向 plan、node、permission、datasource execution 的非阻塞 runtime audit event contract。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-audit` 正式包名。

## 0.1.0 (2026-04-18)

- query、mutation、migration 与 access 审计落盘能力的首个基线版本。
