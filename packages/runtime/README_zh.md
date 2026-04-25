# @zhongmiao/meta-lc-runtime

[English](./README.md) | 中文文档

## 包定位

`runtime` 包含 runtime 侧编排原语：DSL parsing、template resolution、dependency tracking、function registry、rule evaluation、manager adapter、orchestrator 与 websocket event helper。

## 核心职责

- 解析 runtime DSL 并收集 dependencies。
- 跟踪 dependency changes，并编排 refresh/action execution。
- 从 runtime state 解析 template value。
- 注册并执行 runtime function。
- 创建与校验 websocket event payload。

## 与其他包关系

- 直接拥有 V2 runtime DSL、`ViewDefinition`、`ExecutionPlan`、node、runtime event 与 page topic contract。
- BFF websocket code 可以发布与这些 contract 兼容的 runtime event。
- 前端 runtime adapter 消费本包 contract，但不直连数据库或业务 API。
- Query node 通过 `query` 构建 AST，经过 `permission` AST transform 后编译 SQL，并通过共享 `datasource` adapter 契约执行。
- BFF 负责装配具体 datasource adapter；runtime 不读取 DB config，也不直接访问物理数据。
- Runtime 可以在 plan、node、permission、datasource 边界发出可选 audit observability event，但不改变执行语义。

## 最小闭环

```mermaid
flowchart LR
  Dsl["Runtime DSL"] --> Parser["runtime-dsl-parser"]
  Parser --> Deps["DependencyGraph"]
  Deps --> Orchestrator["RuntimeOrchestrator"]
  Orchestrator --> Event["WS event contract"]
  Event --> BFF["BFF websocket gateway"]
```

## 常用命令

```bash
pnpm --filter @zhongmiao/meta-lc-runtime build
pnpm --filter @zhongmiao/meta-lc-runtime test
```

## 边界约束

- Runtime orchestration 不能内嵌业务专用后端逻辑。
- Runtime consumer 的数据访问仍必须经过 BFF contract。
- Runtime query execution 不能注入 SQL permission clause；必须在 SQL 编译前调用 permission AST transform。
- Runtime audit observer 必须保持可选、非阻塞；observer 失败不得影响 plan execution。
