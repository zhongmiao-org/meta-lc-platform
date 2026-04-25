English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- docs(readme): add runtime upstream/downstream notes for the final execution-engine topology.
- fix(ci): build runtime workspace dependencies before package-local tests on clean runners.
- chore(boundaries): add final Nx layer tags and keep runtime as the only package allowed to depend on kernel/query/permission/datasource/audit together.
- chore(boundaries): rename runtime manager-event tests to interaction-event tests and document RuntimeExecutor as the only bottom execution entry with view/interaction facades above it.
- refactor(boundaries): remove the manager-adapter export and make the runtime gateway facade own view lookup plus execution dependency wiring.
- refactor(executor): move manager event planning under RuntimeExecutor and remove the runtime orchestrator module.
- refactor(contracts): own execution contracts directly while consuming kernel-owned ViewDefinition and node structure contracts.
- feat(observability): emit optional non-blocking runtime audit events for plan, node, permission, and datasource boundaries.
- feat(permission): route query nodes through Permission AST Transform before SQL compilation.
- refactor(datasource): execute query nodes through the shared datasource adapter contract.
- feat(runtime): add a high-level runtime view executor facade that compiles and executes ViewDefinition through RuntimeExecutor.
- refactor(contracts): re-export V2 view and execution plan contracts from the shared contracts package.
- fix(package): align the runtime package main/types entrypoint with the refactored dist/runtime/src layout so downstream packages can resolve it at runtime.
- refactor(package-structure): reorganize src into layered domain/application/infra/interface/types/utils directories and update public entrypoints.
- feat(runtime): add a RuntimeExecutor main engine that schedules DAG layers, commits state snapshots atomically, and resolves final view models.
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
