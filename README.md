# meta-lc-platform

Core monorepo for Meta-Driven lowcode middleware.

This workspace combines reusable platform libraries under `packages/*` with a runnable NestJS middleware entry under `apps/bff-server`. The package docs describe the current code boundaries only; they do not imply that unfinished product APIs are already available.

English | [中文文档](./README_zh.md)

## Architecture Flow

The platform keeps the frontend and runtime behind the BFF. Metadata flows through the Meta Kernel and `meta_db`; business data flows through runtime, query, permission, and datasource execution against `business_db`; audit records belong to `audit_db`.

This diagram shows runtime execution handoff, not package import dependencies. `Permission --> Query` means permission transforms query AST / type contracts and must not execute SQL. `Query --> Datasource` means runtime hands compiled SQL/request output to datasource execution; `query` still must not depend on `datasource`.

```mermaid
flowchart LR
  Client["Runtime / Client<br/>Renderer / Designer / Consumer"]
  BFFServer["apps/bff-server<br/>NestJS bootstrap"]
  BFF["packages/bff<br/>Gateway only<br/>HTTP / WS / request-id / error mapping"]
  Runtime["packages/runtime<br/>Execution engine<br/>View facade / RuntimeExecutor / DAG / State"]
  Kernel["packages/kernel<br/>Structure source of truth<br/>Meta registry / ViewDefinition / Schema / Version"]
  Query["packages/query<br/>Query compiler<br/>AST to SQL"]
  Permission["packages/permission<br/>Permission engine<br/>AST transform + data scope"]
  Datasource["packages/datasource<br/>Datasource contracts<br/>Execution / mutation / org-scope ports"]
  Audit["packages/audit<br/>Observability events<br/>Runtime audit sink"]
  KernelPg["packages/kernel-adapter-postgres<br/>Adapter package<br/>Kernel repository Postgres implementation"]
  InfraScripts["infra/scripts<br/>migrate.ts / seed.ts"]
  MetaDb[("meta_db")]
  BusinessDb[("business_db")]
  AuditDb[("audit_db")]
  Client --> BFFServer
  BFFServer --> BFF
  BFF --> Runtime
  Runtime --> Kernel
  Runtime --> Permission
  Runtime --> Query
  Runtime --> Datasource
  Runtime --> Audit
  KernelPg --> Kernel
  Permission -->|"AST transform / query types"| Query
  Query -->|"compiled request"| Datasource
  KernelPg --> MetaDb
  Datasource --> BusinessDb
  Audit --> AuditDb
  InfraScripts --> MetaDb
  InfraScripts --> BusinessDb
  InfraScripts --> AuditDb
```

## Package Model

The SDK is organized as `7 core packages + N adapter packages`.

- Core packages own stable contracts, domain/application behavior, gateway code, and runtime orchestration.
- Adapter packages own concrete technology bindings such as database drivers. They may depend on a core package plus external drivers, but core packages must not depend on adapters.
- Current adapter packages: `packages/kernel-adapter-postgres`. Future adapters should follow the `*-adapter-*` shape and stay outside the seven core packages.

## Core Package Index

| Package | Role | Docs |
| --- | --- | --- |
| `packages/runtime` | RuntimeExecutor execution engine, DAG/state execution contracts, runtime gateway facade, and WS event contracts. | [English](./packages/runtime/README.md) \| [中文文档](./packages/runtime/README_zh.md) |
| `packages/kernel` | Structural metadata contracts, MetaSchema validation, definition registry, diff, and migration SQL helpers. | [English](./packages/kernel/README.md) \| [中文文档](./packages/kernel/README_zh.md) |
| `packages/query` | Query AST / DSL to SQL compilation. | [English](./packages/query/README.md) \| [中文文档](./packages/query/README_zh.md) |
| `packages/permission` | RBAC and organization data-scope decisions. | [English](./packages/permission/README.md) \| [中文文档](./packages/permission/README_zh.md) |
| `packages/datasource` | Stable datasource execution contracts; concrete implementations live behind root or secondary adapter entries. | [English](./packages/datasource/README.md) \| [中文文档](./packages/datasource/README_zh.md) |
| `packages/audit` | Audit contracts and optional non-blocking runtime observability sinks. | [English](./packages/audit/README.md) \| [中文文档](./packages/audit/README_zh.md) |
| `packages/bff` | NestJS IO Gateway for HTTP/WS DTOs, runtime controller entrypoints, request-id, and error mapping. | [English](./packages/bff/README.md) \| [中文文档](./packages/bff/README_zh.md) |

## Adapter Package Index

| Package | Role | Docs |
| --- | --- | --- |
| `packages/kernel-adapter-postgres` | Postgres implementation of the kernel repository port for app/example composition roots. | [English](./packages/kernel-adapter-postgres/README.md) \| [中文文档](./packages/kernel-adapter-postgres/README_zh.md) |

## SDK Consumer Rules

- Import only from package roots or approved secondary entries such as `@zhongmiao/meta-lc-runtime/core`, `@zhongmiao/meta-lc-datasource/postgres`, and `@zhongmiao/meta-lc-audit/postgres`.
- Do not deep import package internals such as `src/*` subpaths under `@zhongmiao/meta-lc-*` packages, `*/domain/*`, `*/application/*`, `*/infra/*`, or implementation file paths.
- Use `@zhongmiao/meta-lc-runtime` only for runtime facade functions; import runtime contracts, errors, constants, and event types from `@zhongmiao/meta-lc-runtime/core`.
- Compose Postgres adapters only in app/example composition roots or infra scripts. Core packages and BFF must not directly wire concrete Postgres adapters.
- Treat package-local tests that import `../src/domain` or `../src/application` as internal test coverage only; they are not SDK consumer examples.

## Dependency Direction

- `runtime`, `kernel`, `query`, `permission`, `datasource`, `bff`, and `audit` are the seven core architecture packages.
- Adapter packages are intentionally outside the core set; they are implementation bindings consumed by composition roots, apps, examples, or infra scripts.
- Migration lifecycle scripts live under `infra/`; `packages/migration` is intentionally removed.
- Contracts live in the owning package; `contracts`, `shared`, `platform`, and `migration` packages are intentionally removed.
- Final workspace dependencies are locked as: app -> bff; bff -> runtime; runtime -> kernel/query/permission/datasource/audit; permission -> query.
- `kernel`, `query`, `datasource`, and `audit` must not depend on any workspace package.
- `runtime -> kernel` is allowed so runtime can read structure definitions; `kernel -> runtime` and `kernel -> permission` are forbidden.
- `query` compiles AST to SQL and must not depend on `datasource`, `runtime`, or `permission`.
- `bff` remains a gateway and must not own runtime orchestration, datasource wiring, permission decisions, audit wiring, or DB access.
- `bff` must not depend on `kernel`; `/meta/*` may use an injected meta registry provider, and any kernel-backed provider must be composed outside the BFF package.
- Core packages must not import `@zhongmiao/meta-lc-kernel-adapter-postgres`; only composition roots may wire it.
- Deep cross-package imports are forbidden; import through package entrypoints.

### Compiler / Execution Boundaries

- `packages/query`: owns Query AST -> SQL compile; must not execute SQL; must not depend on datasource.
- `packages/datasource`: owns physical execution; receives compiled request / SQL command; must not compile Query AST; must not depend on query / permission / runtime.
- `packages/permission`: owns AST transform only; may use type-only imports from query AST/types if needed; must not value-import the query compiler; must not compile SQL; must not execute datasource.

## Runtime Entries

- `packages/bff`: library form of the NestJS BFF module.
- `apps/bff-server`: runnable middleware process entry.

## Examples

- Business demos live under `examples/*`, not inside core packages.
- `examples/orders-demo` owns the orders workbench seed metadata, demo mutation adapter, and `001_orders_demo.sql`.
- Deleting `examples/` must not affect `packages/*` build or test; examples may depend on packages, but packages must never depend on examples.
- Examples are demonstration applications only and are not part of the core platform package topology.

## Commands

```bash
pnpm install
pnpm -r build
pnpm -r test
pnpm lint
pnpm --filter @zhongmiao/meta-lc-bff-server start
pnpm infra:up
pnpm infra:query-gate
pnpm test:examples:orders-demo
```

## Architectural Constraints

- Frontend consumers enter through the BFF for HTTP and realtime protocols; page execution then crosses exactly one boundary into the runtime facade.
- `meta_db`, `business_db`, and `audit_db` stay separated.
- Kernel remains the structural source for metadata and migration planning.
- BFF is an IO Gateway only: it owns HTTP/WS DTOs, controllers, and bootstrap wiring, not orchestration or data execution.
- RuntimeExecutor is the only execution engine; runtime owns execution wiring and consumes query, permission, datasource, audit, and kernel boundaries.
- DB driver access is intentionally restricted by boundary checks.

## Release Governance

- Publishable library identities use the `@zhongmiao/meta-lc-*` scope.
- Root changelogs record platform, runtime, and service-level changes.
- Package changelogs record package-local API and behavior changes.
