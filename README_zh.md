# meta-lc-platform

`meta-lc-platform` 是 Meta-Driven lowcode middleware 的核心 monorepo。

本仓库把 `packages/*` 下的可复用平台库和 `apps/bff-server` 下的可运行 NestJS middleware 入口放在同一个工作区中。本文档只描述当前代码边界，不表示尚未实现的产品接口已经可用。

[English](./README.md) | 中文文档

## 架构协作流

平台约束是所有前端与 runtime 数据访问必须经过 BFF。元数据通过 Meta Kernel 进入 `meta_db`；业务查询与变更通过 runtime、query、permission、datasource 访问 `business_db`；审计记录进入 `audit_db`。

下图表达 runtime 执行交接关系，不是 package import 依赖图。`Permission --> Query` 表示 permission transform 作用于 query AST / query type contract，且 permission 不执行 SQL。`Query --> Datasource` 表示 runtime 将 query 编译后的 SQL/request 产物交给 datasource 执行；`query` 仍然禁止依赖 `datasource`。

```mermaid
flowchart LR
  Client["Runtime / Client<br/>Renderer / Designer / Consumer"]
  BFFServer["apps/bff-server<br/>NestJS bootstrap"]
  BFF["packages/bff<br/>Gateway only<br/>HTTP / WS / request-id / error mapping"]
  Runtime["packages/runtime<br/>Execution engine<br/>View facade / RuntimeExecutor / DAG / State"]
  Kernel["packages/kernel<br/>Structure source of truth<br/>Meta registry / ViewDefinition / Schema / Version"]
  Query["packages/query<br/>Query compiler<br/>AST to SQL"]
  Permission["packages/permission<br/>Permission engine<br/>AST transform + data scope"]
  Datasource["packages/datasource<br/>Datasource adapter<br/>Postgres / mutation / org-scope adapters"]
  Audit["packages/audit<br/>Observability events<br/>Runtime audit sink"]
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
  Permission -->|"AST transform / query types"| Query
  Query -->|"compiled request"| Datasource
  Kernel --> MetaDb
  Datasource --> BusinessDb
  Audit --> AuditDb
  InfraScripts --> MetaDb
  InfraScripts --> BusinessDb
  InfraScripts --> AuditDb
```

## 子包索引

| Package | 定位 | 文档 |
| --- | --- | --- |
| `packages/runtime` | RuntimeExecutor 执行引擎、DAG/state 执行契约、runtime gateway facade 与 WS event contract。 | [English](./packages/runtime/README.md) \| [中文文档](./packages/runtime/README_zh.md) |
| `packages/kernel` | 结构元数据契约、MetaSchema 校验、definition registry、diff 与 migration SQL helper。 | [English](./packages/kernel/README.md) \| [中文文档](./packages/kernel/README_zh.md) |
| `packages/query` | Query AST / DSL 到 SQL 编译。 | [English](./packages/query/README.md) \| [中文文档](./packages/query/README_zh.md) |
| `packages/permission` | RBAC 与组织数据域决策。 | [English](./packages/permission/README.md) \| [中文文档](./packages/permission/README_zh.md) |
| `packages/datasource` | Postgres datasource 配置与执行 adapter。 | [English](./packages/datasource/README.md) \| [中文文档](./packages/datasource/README_zh.md) |
| `packages/audit` | 审计契约与可选、非阻塞 runtime observability sink。 | [English](./packages/audit/README.md) \| [中文文档](./packages/audit/README_zh.md) |
| `packages/bff` | NestJS IO Gateway，持有 HTTP/WS DTO、runtime controller 入口、request-id 与错误映射。 | [English](./packages/bff/README.md) \| [中文文档](./packages/bff/README_zh.md) |

## 依赖方向

- `runtime`、`kernel`、`query`、`permission`、`datasource`、`bff`、`audit` 是最终 7 个架构层包。
- migration lifecycle scripts 下沉到 `infra/`；`packages/migration` 已被删除。
- contract 由所属包拥有；`contracts`、`shared`、`platform`、`migration` 包已被删除。
- 最终 workspace 依赖锁定为：app -> bff；bff -> runtime；runtime -> kernel/query/permission/datasource/audit；permission -> query。
- `kernel`、`query`、`datasource`、`audit` 禁止依赖任何 workspace package。
- 允许 `runtime -> kernel` 读取结构定义；禁止 `kernel -> runtime` 与 `kernel -> permission`。
- `query` 只负责 AST 到 SQL 编译，禁止依赖 `datasource`、`runtime` 或 `permission`。
- `bff` 只作为 gateway，不拥有 runtime orchestration、datasource wiring、permission decision、audit wiring 或 DB access。
- `bff` 禁止依赖 `kernel`；`/meta/*` 可以使用注入的 meta registry provider，任何 kernel-backed provider 都必须在 BFF package 外部装配。
- 禁止 deep import，跨包引用必须通过 package entrypoint。

### 编译 / 执行边界

- `packages/query` 拥有 Query AST -> SQL 编译职责，禁止执行 SQL，禁止依赖 `datasource`。
- `packages/datasource` 拥有物理执行职责，接收 compiled request 或 SQL command，禁止编译 Query AST，禁止依赖 `query`、`permission` 或 `runtime`。
- `packages/permission` 只拥有 AST transform，仅允许 type-only 依赖 query 的 AST/types，禁止 value import query compiler，禁止编译 SQL，禁止执行 datasource 请求。

## 运行入口

- `packages/bff`：NestJS BFF module 的库形态。
- `apps/bff-server`：middleware 进程入口。

## Examples

- 业务 demo 放在 `examples/*`，不放入核心 packages。
- `examples/orders-demo` 拥有 orders workbench 的 seed metadata、demo mutation adapter 与 `001_orders_demo.sql`。
- 删除 `examples/` 不应影响 `packages/*` build 或 test；examples 可以依赖 packages，但 packages 永远不能依赖 examples。
- examples 仅作为演示应用，不属于核心平台包拓扑。

## 常用命令

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

## 架构约束

- 前端 consumer 通过 BFF 进入 HTTP 与实时协议；页面执行随后只跨一次边界进入 runtime facade。
- `meta_db`、`business_db`、`audit_db` 保持三库分离。
- Kernel 是元数据结构与迁移计划的来源。
- BFF 只能作为 IO Gateway，持有 HTTP/WS DTO、controller 与 bootstrap wiring，不持有 orchestration 或 data execution。
- RuntimeExecutor 是唯一执行引擎；runtime 拥有 execution wiring，并消费 query、permission、datasource、audit、kernel 边界。
- DB driver access 受 boundary check 限制。

## 发版治理

- 可发布库身份使用 `@zhongmiao/meta-lc-*` scope。
- 根 changelog 记录平台、runtime、service 级变化。
- 子包 changelog 记录包内 API 与行为变化。
