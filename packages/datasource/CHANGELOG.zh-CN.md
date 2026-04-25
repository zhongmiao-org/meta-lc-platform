[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- docs(readme): 明确 datasource 上下游关系与仅负责物理执行的边界。
- chore(boundaries): 新增最终 Nx layer tags，并禁止 datasource 依赖 workspace package。
- chore(boundaries): 重命名 Postgres demo runtime adapters，显式标记 demo-orders 与 org-scope 边界。
- feat(adapter): 新增 Postgres demo orders mutation 与 org-scope loader，让 runtime 拥有执行装配且 BFF 不再访问 DB。
- feat(adapter): 新增稳定 datasource execution 契约与 Postgres adapter 结果归一化。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-datasource` 正式包名。

## 0.1.0 (2026-04-18)

- PostgreSQL 数据执行适配层的首个基线版本。
