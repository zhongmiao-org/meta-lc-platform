[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- refactor(contracts): 由 runtime 直接拥有 V2 runtime DSL、ViewDefinition、ExecutionPlan、node 与 runtime event contract。
- feat(observability): 在 plan、node、permission、datasource 边界发出可选、非阻塞 runtime audit event。
- feat(permission): query node 在 SQL 编译前接入 Permission AST Transform。
- refactor(datasource): query node 改为通过共享 datasource adapter 契约执行。
- feat(runtime): 新增高层 runtime view executor facade，通过 RuntimeExecutor 编译并执行 ViewDefinition。
- refactor(contracts): 从共享 contracts 包转导 V2 view 与 execution plan 契约。
- fix(package): 将 runtime 包的 main/types 入口对齐到重构后的 `dist/runtime/src` 目录，确保下游包可在运行时正确解析。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- feat(runtime): 新增 RuntimeExecutor 主执行引擎，负责 DAG 分层调度、原子提交 state snapshot 并解析最终 view model。
- feat(runtime): 新增 merge 执行器，支持 V2 fan-in 策略与自定义 merge hook。
- feat(runtime): 新增 QueryExecutor 适配层，负责编译 query 节点并执行 datasource 查询。
- feat(runtime): 新增面向 V2 runtime node 的纯 NodeExecutor 分发系统。
- feat(runtime): 新增面向 V2 runtime value 的确定性表达式解析器。
- feat(runtime): 新增面向 V2 ExecutionPlan edges 的纯 DAG 调度器。
- feat(runtime): 新增 V2 Runtime Orchestrator 的纯 ViewDefinition 到 ExecutionPlan 编译器。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-runtime` 正式包名。
- feat(runtime): 新增依赖图构建与自动刷新规划，覆盖 state 与 mutation 成功事件。
- feat(runtime): 新增最小 FunctionRegistry 与 RuleEngine，支持事件驱动的规则 effect 计算。
- feat(runtime): 新增 manager-first orchestration plan，统一 refresh planning、rule effects、next state、manager commands 与 WebSocket topics。
- feat(runtime): 新增 manager adapter 执行契约，用于执行 orchestrator command plan。
- feat(runtime): 新增 helper，将 manager 执行结果转换为 WebSocket 更新事件。

## 0.1.0 (2026-04-18)

- Phase 4 runtime parser 与模板解析器的首个基线版本。
