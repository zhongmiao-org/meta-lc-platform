[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-runtime` 正式包名。
- feat(runtime): 新增依赖图构建与自动刷新规划，覆盖 state 与 mutation 成功事件。
- feat(runtime): 新增最小 FunctionRegistry 与 RuleEngine，支持事件驱动的规则 effect 计算。
- feat(runtime): 新增 manager-first orchestration plan，统一 refresh planning、rule effects、next state、manager commands 与 WebSocket topics。
- feat(runtime): 新增 manager adapter 执行契约，用于执行 orchestrator command plan。

## 0.1.0 (2026-04-18)

- Phase 4 runtime parser 与模板解析器的首个基线版本。
