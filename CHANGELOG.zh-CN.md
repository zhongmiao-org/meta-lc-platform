[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- feat(release): 新增聚合总包 `@zhongmiao/meta-lc-platform`，并为工作区包统一预留 `@zhongmiao/meta-lc-*` 命名。
- feat(ci): 新增 changelog gate、release draft 同步与手动 changelog finalize 工作流，补齐平台发版治理基础。
- docs(changelog): 为平台工作区建立根级与包级双语 changelog 基线。
- feat(runtime): 新增依赖图规划能力，让 runtime 可由 state 与 mutation 事件驱动确定性自动刷新执行。
- feat(runtime): 新增最小 RuleEngine 与 FunctionRegistry，让 runtime 事件可计算规则驱动的 state patch、action 与 datasource refresh。
- docs(runtime): 将 runtime contract、前端接入、迁移指引与测试手册同步到当前 manager-first 实现口径。
- fix(boundaries): 将 `pg` 直连点收紧到显式的 BFF/datasource/kernel 入口，并把 audit 包移出过渡白名单。
- fix(boundaries): 将 DB driver 边界检查从过渡白名单升级为显式包/文件策略检查，并补充自测。
- feat(bff): 新增首版 Gateway 基线，覆盖 meta API、内存 cache、aggregation summary 与 WebSocket lifecycle smoke。
- feat(runtime): 新增 manager-first runtime orchestrator 基线与共享 runtime page topic helper。
- feat(kernel): 新增 SQL Generator V1 基线，覆盖 table、index、relation 与 compiler fixture。
- test(kernel): 将 SQL generator 示例提升为可复用的 compiler contract fixture 基线。
- feat(kernel): 新增 API Generator V1 route manifest 基线，并将 compiler fixture 扩展到 SQL 与 API 输出。
- feat(contracts): 新增 query 与 mutation 响应契约，供生成的 API route manifest 引用。
- feat(kernel): 新增 Permission Generator V1 manifest 基线，完成 SQL、API 与 permission 输出的 compiler fixture 覆盖。

## 0.1.0 (2026-04-18)

- Meta-Driven middleware monorepo 的首个内部基线版本。
- 包含 BFF 运行入口、query/mutation 编排、审计落盘、migration bootstrap，以及 Phase 4 runtime parser/resolver 起步能力。
