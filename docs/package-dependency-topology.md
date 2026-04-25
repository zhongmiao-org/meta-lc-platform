# meta-lc-platform 包依赖拓扑图

生成口径：

- 范围：`pnpm-workspace.yaml` 中的 `packages/*` 与 `apps/*`。
- 主图：只统计生产代码 `src/**/*.ts`。
- 边方向：`A --> B` 表示 **A 的源码 import/export/require 了 B**。
- `packages/migration` 已删除；migration lifecycle 下沉到 `infra/` scripts，并复用 `kernel` 内部能力。
- `packages/contracts`、`packages/shared`、`packages/platform` 已删除；contract 归属具体架构层包。

## 拓扑图

```mermaid
flowchart TD
  bff_server["@zhongmiao/meta-lc-bff-server<br/>apps/bff-server"]
  bff["@zhongmiao/meta-lc-bff<br/>packages/bff"]
  runtime["@zhongmiao/meta-lc-runtime<br/>packages/runtime"]
  kernel["@zhongmiao/meta-lc-kernel<br/>packages/kernel"]
  permission["@zhongmiao/meta-lc-permission<br/>packages/permission"]
  query["@zhongmiao/meta-lc-query<br/>packages/query"]
  datasource["@zhongmiao/meta-lc-datasource<br/>packages/datasource"]
  audit["@zhongmiao/meta-lc-audit<br/>packages/audit"]

  bff_server --> bff
  bff --> audit
  bff --> datasource
  bff --> kernel
  bff --> permission
  bff --> runtime
  runtime --> audit
  runtime --> datasource
  runtime --> kernel
  runtime --> permission
  runtime --> query
  kernel --> permission
  permission --> query
```

## 分层视图

按 import 方向从入口到基础包看：

1. `@zhongmiao/meta-lc-bff-server`
2. `@zhongmiao/meta-lc-bff`
3. `@zhongmiao/meta-lc-runtime`
4. `@zhongmiao/meta-lc-kernel`
5. `@zhongmiao/meta-lc-permission`
6. `@zhongmiao/meta-lc-query`, `@zhongmiao/meta-lc-datasource`, `@zhongmiao/meta-lc-audit`

当前生产代码包依赖图没有发现环。

## 架构结论

- `runtime` 是唯一执行核心，持有 `ExecutionPlan`、`ExecutionNode`、`Expression`、`RuntimeContext` 等执行契约。
- `kernel` 是结构真源，持有 `MetaSchema`、`ViewDefinition`、`NodeDefinition`、`DatasourceDefinition`、`PermissionPolicy`。
- `bff` 是 IO Gateway，只持有 HTTP/WS DTO、controller、bootstrap wiring 与 infra adapter。
- `infra/` 承载 bootstrap SQL、docker、query-gate 等运维脚本，不作为 workspace package。
