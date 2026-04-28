[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- chore(boundaries): 围绕 datasource root 与 Postgres secondary entry 锁定 package exports 和 deep import 规则。
- chore(sdk): 将 Postgres adapter secondary entry 使用的 `pg` 调整为可选 peer dependency。
- refactor(public-api): 将 Postgres adapter 移到 `@zhongmiao/meta-lc-datasource/postgres` secondary entry，并保持包根只导出 contract。
- refactor(adapter): 从 datasource 移除 orders demo mutation adapter，并将业务 demo wiring 迁入 `examples/orders-demo`。
- docs(readme): 明确 datasource 上下游关系与仅负责物理执行的边界。
- chore(boundaries): 新增最终 Nx layer tags，并禁止 datasource 依赖 workspace package。
- feat(adapter): 新增 Postgres org-scope loader，让 runtime 拥有执行装配且 BFF 不再访问 DB。
- feat(adapter): 新增稳定 datasource execution 契约与 Postgres adapter 结果归一化。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-datasource` 正式包名。

## 0.1.0 (2026-04-18)

- PostgreSQL 数据执行适配层的首个基线版本。
