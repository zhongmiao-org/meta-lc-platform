English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- feat(runtime): add a merge executor for V2 fan-in strategies and custom merge hooks.
- feat(runtime): add a query executor adapter that compiles query nodes and runs datasource queries.
- feat(runtime): add a pure NodeExecutor dispatch system for V2 runtime nodes.
- feat(runtime): add a deterministic expression resolver for V2 runtime values.
- feat(runtime): add a pure DAG scheduler for V2 ExecutionPlan edges.
- feat(runtime): add a pure ViewDefinition to ExecutionPlan compiler for V2 Runtime Orchestrator.
- docs(readme): add bilingual package README and minimal architecture flow.
- chore(package): adopt the `@zhongmiao/meta-lc-runtime` scoped package identity for release governance.
- feat(runtime): add dependency graph construction and auto-refresh planning for state and mutation events.
- feat(runtime): add a minimal function registry and rule engine for event-driven runtime effects.
- feat(runtime): add a manager-first orchestration plan that combines refresh planning, rule effects, next state, manager commands, and WebSocket topics.
- feat(runtime): add a manager adapter execution contract for orchestrator command plans.
- feat(runtime): add a helper that converts manager execution results into WebSocket update events.

## 0.1.0 (2026-04-18)

- Initial runtime parser and template resolver baseline for Phase 4 execution planning.
