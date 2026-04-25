[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- refactor(meta): 从 kernel 移除 orders demo registry seeds，并将 example-owned metadata 迁入 `examples/orders-demo`。
- docs(readme): 补充 kernel 元数据归属与 meta_db 持久化的上下游关系说明。
- fix(package): 将 kernel package main/types 入口对齐到无 workspace 依赖后的 clean build 输出路径。
- chore(boundaries): 将 `DataScopeType` 作为本地结构字面量持有，移除 permission 包依赖，确保 kernel 不依赖任何 workspace package。
- refactor(contracts): 由 kernel 直接拥有 ViewDefinition 与 node 结构契约，并保持不依赖 runtime。
- refactor(contracts): 由 kernel 直接拥有 datasource、permission policy、view 与 node 结构契约。
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
