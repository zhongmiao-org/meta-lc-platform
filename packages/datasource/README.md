# @zhongmiao/meta-lc-datasource

English | [中文文档](./README_zh.md)

## Package Role

`datasource` owns physical data execution adapters. The current implementation focuses on a stable datasource execution contract and a Postgres adapter.

## Responsibilities

- Define datasource and DB configuration types.
- Create Postgres clients from environment-backed configuration.
- Execute compiled SQL through the adapter boundary and normalize rows, row counts, metadata, and errors.

## Relationship With Other Packages

- Upstream: `runtime`.
- Downstream: `business_db`; datasource has no workspace package dependencies.
- `runtime` consumes datasource adapters through a stable execution contract.
- Runtime wires concrete Postgres adapters for page execution; BFF does not depend on this package.
- `query` produces SQL that a datasource adapter can execute.
- `permission` affects the constraints included before execution.
- `kernel` remains separate; metadata versioning is not owned by this package.
- Orders-specific demo mutation logic lives in `examples/orders-demo`; core datasource only keeps generic Postgres execution and platform adapter edges such as org-scope loading.

## Minimal Flow

```mermaid
flowchart LR
  Config["DbConfig"] --> Adapter["PostgresDatasourceAdapter"]
  Request["DatasourceExecutionRequest<br/>SQL + params"] --> Adapter
  Adapter --> BusinessDb[("business_db")]
  BusinessDb --> Result["rows / rowCount / metadata"]
```

## Commands

```bash
pnpm --filter @zhongmiao/meta-lc-datasource build
pnpm --filter @zhongmiao/meta-lc-datasource test
```

## Boundary Notes

- Keep adapter code focused on database execution and lifecycle.
- Receives compiled request / SQL command.
- Must not compile Query AST.
- Must not depend on query / permission / runtime.
- Business demo adapters must live under `examples/*`, not in this package.
- Keep platform adapters generic; business semantics must not become implicit datasource orchestration.
- Do not add HTTP controller or runtime orchestration here.
- Do not read BFF-specific request objects here.
