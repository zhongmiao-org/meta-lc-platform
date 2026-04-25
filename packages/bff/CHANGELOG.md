English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- chore(boundaries): add final Nx layer tags and lock BFF dependency gates to runtime/kernel only.
- chore(boundaries): seal the gateway-only layout by removing mapper/repository/interface remnants, adding gateway-only config, and tightening dependency guards.
- refactor(boundaries): remove BFF contracts and data execution dependencies so view controllers only call the runtime gateway facade.
- refactor(gateway): remove the BFF application layer so controllers act as thin runtime/kernel gateways with infra wiring only.
- refactor(contracts): consume runtime, kernel, and permission-owned contracts instead of a transitional contracts package.
- feat(observability): persist runtime audit events through a BFF infra observer without blocking view execution.
- refactor(meta): read demo view, datasource, and permission definitions from the Kernel-backed registry.
- test(permission): assert BFF view gateway context flows into runtime Permission AST Transform.
- refactor(datasource): route BFF runtime view query execution through the datasource package adapter.
- fix(boundaries): remove legacy `/query` and `/mutation` orchestration surfaces so BFF only acts as a runtime gateway.
- test(gateway): retarget the e2e gate from removed legacy query/mutation endpoints to `POST /view/:name`.
- refactor(gateway): route view execution through the runtime view facade and move Postgres runtime adapter wiring into infra.
- refactor(layering): rebuild `src` into strict controller/application/domain/infra/contracts layering, move runtime WebSocket under `controller/ws/runtime`, split type/interface files, and enforce the rules with ESLint plus boundary checks.
- feat(gateway): add `POST /view/:name` and a temporary runtime-backed view adapter so BFF can route page requests through the runtime executor.
- refactor(package-structure): reorganize src into layered domain/application/infra/interface/types/utils directories and update public entrypoints.
- docs(readme): add bilingual package README and minimal architecture flow.
- feat(gateway): add meta API, in-memory cache, aggregation summary, and WebSocket lifecycle baseline.
- feat(api-contracts): annotate query and mutation controller responses with shared API response contracts.
- chore(gateway): reuse the shared runtime page topic helper for WebSocket subscription acknowledgements.
- chore(package): adopt the `@zhongmiao/meta-lc-bff` scoped package identity for release governance.
- fix(local-dev): move the default BFF local port to `6001` and bind an explicit host so browser-based integration can reach the service without unsafe-port blocking.
- test(permission-gate): expand the query/mutation gate baseline to cover `SELF`, `DEPT_AND_CHILDREN`, and `CUSTOM_ORG_SET` permission paths in addition to the existing `DEPT` denied checks.
- feat(permission-seed): add custom-org and self-scope demo identities so org-scope policies can be exercised in e2e and remote bootstrap flows.
- feat(gateway): add a WebSocket emit baseline for runtime manager-executed updates.
- feat(gateway): add topic-room broadcast and in-memory replay for runtime manager-executed updates.
- feat(gateway): add a configurable runtime WebSocket replay store with a Redis-backed latest-event adapter.
- feat(gateway): add a configurable runtime WebSocket broadcast bus with Redis pub/sub fanout.
- feat(gateway): add runtime WebSocket operations status and health visibility.
- feat(gateway): add Redis Stream cursor replay for runtime WebSocket updates.

## 0.1.0 (2026-04-18)

- Initial middleware orchestration baseline for BFF query, mutation, bootstrap, and audit flows.
