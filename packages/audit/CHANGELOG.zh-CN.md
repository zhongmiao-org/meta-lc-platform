[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- feat(observability): 新增面向 plan、node、permission、datasource execution 的非阻塞 runtime audit event contract。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-audit` 正式包名。
- refactor(boundary): 将本包收回为审计契约与兼容辅助层，避免审计数据库执行职责继续外溢到 BFF 边界之外。

## 0.1.0 (2026-04-18)

- query、mutation、migration 与 access 审计落盘能力的首个基线版本。
