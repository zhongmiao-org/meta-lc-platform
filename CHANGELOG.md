English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- chore(examples): extract the orders demo metadata, SQL seed, and mutation adapter out of core packages into `examples/orders-demo`.
- docs(readme): sync the final architecture flow, package relationship notes, and compiler/execution boundary wording.
- fix(ci): build workspace dependencies before package-local tests so clean CI runners can resolve package entrypoints.
- chore(boundaries): lock final dependency gates with Nx module-boundary tags, full-workspace ESLint, and hard checks that prevent kernel/query/datasource/audit workspace dependencies.
- chore(boundaries): seal the final seven-package topology with stricter BFF gateway layout, runtime entry naming, datasource demo adapter names, and dependency gates.
- refactor(boundaries): lock the final runtime gateway topology by removing BFF data wiring, moving execution dependencies into runtime, and forbidding kernel-to-runtime dependency drift.
- refactor(architecture): finalize runtime, kernel, BFF, and migration boundaries by removing BFF application orchestration, runtime orchestrator remnants, and the migration package.
- refactor(packages): converge the final package topology by deleting contracts, shared, and platform transitional packages.
- feat(audit): add non-blocking runtime observability events and BFF persistence wiring for plan, node, permission, and datasource execution.
- feat(kernel): add a versioned meta definition registry for view, datasource, and permission policy definitions.
- feat(permission): add Query AST permission transforms and route runtime query compilation through them.
- feat(datasource): converge runtime query execution onto the shared datasource adapter contract.
- fix(boundaries): close Task 1-9 runtime boundary gaps by removing legacy BFF query/mutation orchestration and adding guards against regressions.
- feat(runtime): add a high-level runtime view executor facade for BFF gateway integration.
- feat(contracts): move V2 ViewDefinition, ExecutionPlan, and node contracts into the shared contracts package.
- refactor(bff): enforce strict BFF layering with controller/http/ws/cli entry points, split type/interface contracts, and add ESLint plus boundary guards.
- feat(bff): add a `POST /view/:name` gateway with a temporary runtime-backed adapter so page requests flow through the runtime executor.
- fix(runtime): align the runtime package entrypoint with the refactored `dist/runtime/src` output so downstream packages can resolve it at runtime.
- refactor(package-structure): reorganize the workspace packages into layered domain/application/infra/interface/types/utils directories and refresh boundary checks.
- feat(runtime): add a RuntimeExecutor main engine that schedules DAG layers, commits state snapshots atomically, and resolves final view models.
- feat(runtime): add a query executor adapter that compiles query nodes and runs datasource queries.
- docs(readme): add bilingual package README index and architecture diagrams.
- feat(release): add aggregate package `@zhongmiao/meta-lc-platform` and reserve `@zhongmiao/meta-lc-*` naming for workspace packages.
- feat(ci): add changelog gate, release draft sync, and manual changelog finalize workflow for platform release governance.
- docs(changelog): establish bilingual root/package changelog baselines for the platform workspace.
- feat(runtime): add dependency graph planning so runtime state and mutation events can drive deterministic auto-refresh execution.
- feat(runtime): add a minimal rule engine and function registry so runtime events can compute rule-driven patches, actions, and datasource refreshes.
- docs(runtime): sync the runtime contract, frontend integration, migration guidance, and testing playbook to the current manager-first implementation.
- fix(boundaries): tighten direct `pg` access down to explicit BFF/datasource/kernel entry points and remove the audit package from the transitional DB-driver allowlist.
- fix(boundaries): promote DB-driver boundary checks from a transitional allowlist to explicit package/file policy checks with self-tests.
- feat(bff): add the first Gateway baseline for meta APIs, in-memory cache, aggregation summary, and WebSocket lifecycle smoke.
- feat(runtime): add a manager-first runtime orchestrator baseline and shared runtime page topic helper.
- feat(kernel): add a SQL Generator V1 baseline for tables, indexes, relations, and compiler fixture coverage.
- test(kernel): promote SQL generator examples into a reusable compiler contract fixture baseline.
- feat(kernel): add an API Generator V1 route manifest baseline and extend compiler fixtures across SQL and API outputs.
- feat(contracts): add query and mutation response contracts for generated API route manifests.
- feat(kernel): add a Permission Generator V1 manifest baseline and complete compiler fixture coverage across SQL, API, and permission outputs.
- feat(kernel): add tenant, app, rule, and permission metadata to the versioned MetaSchema contract.
- feat(runtime): add a manager adapter execution contract for orchestrator command plans.
- feat(runtime): add a Runtime WebSocket manager-executed event contract and BFF emit baseline.
- feat(bff): add Runtime WebSocket topic-room broadcast and in-memory replay baseline.
- feat(bff): add a configurable Runtime WebSocket replay store with a Redis-backed latest-event adapter.
- feat(bff): add a configurable Runtime WebSocket broadcast bus with Redis pub/sub fanout.
- feat(bff): add Runtime WebSocket operations status and health visibility.
- feat(bff): add Redis Stream cursor replay for Runtime WebSocket updates.

## 0.1.0 (2026-04-18)

- Initial internal baseline for the Meta-Driven middleware monorepo.
- Includes BFF runtime entry, query/mutation orchestration, audit persistence, migration bootstrap, and Phase 4 runtime parser/resolver bootstrap.
