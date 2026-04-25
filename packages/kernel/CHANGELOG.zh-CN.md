[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- refactor(contracts): 由 kernel 直接拥有 datasource 与 permission policy definition contract，并消费 runtime 拥有的 view definition。
- feat(meta-registry): 新增 view、datasource 与 permission policy definition 的版本化 registry API。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-kernel` 正式包名。
- feat(sql-generator): 新增 table、index、relation SQL 生成能力与 compiler fixture 基线。
- test(compiler): 新增可复用 compiler contract fixture，固化 SQL generator 输出。
- feat(api-generator): 新增稳定 route manifest 生成器，并将 compiler fixture 覆盖扩展到 API 输出。
- feat(permission-generator): 新增稳定 permission manifest 生成器，完成 compiler fixture 覆盖。
- feat(schema): 将 tenant、app、rule 与 permission 元数据纳入可版本化 MetaSchema 契约。

## 0.1.0 (2026-04-18)

- Snapshot、diff 与 migration DSL 唯一真源内核的首个基线版本。
