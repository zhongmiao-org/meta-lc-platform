# @zhongmiao/meta-lc-runtime

English | [中文文档](./README_zh.md)

## Package Role

`runtime` contains runtime-side orchestration primitives: DSL parsing, template resolution, dependency tracking, function registry, rule evaluation, manager adapter, orchestrator, and websocket event helpers.

## Responsibilities

- Parse runtime DSL and collect dependencies.
- Track dependency changes and orchestrate refresh/action execution.
- Resolve template values from runtime state.
- Register and execute runtime functions.
- Create and validate websocket event payloads.

## Relationship With Other Packages

- Depends on `contracts` for shared runtime event and page topic contracts.
- BFF websocket code can publish runtime events compatible with these contracts.
- Frontend runtime adapters consume the package contract without direct database or business API access.
- `query`, `permission`, and `datasource` remain server-side concerns composed by BFF.

## Minimal Flow

```mermaid
flowchart LR
  Dsl["Runtime DSL"] --> Parser["runtime-dsl-parser"]
  Parser --> Deps["DependencyGraph"]
  Deps --> Orchestrator["RuntimeOrchestrator"]
  Orchestrator --> Event["WS event contract"]
  Event --> BFF["BFF websocket gateway"]
```

## Commands

```bash
pnpm --filter @zhongmiao/meta-lc-runtime build
pnpm --filter @zhongmiao/meta-lc-runtime test
```

## Boundary Notes

- Runtime orchestration must not embed business-specific backend logic.
- Runtime consumers must still access data through BFF contracts.
