# @zhongmiao/meta-lc-runtime

[English](./README.md) | 中文文档

## 包定位

`runtime` 是唯一执行核心。它拥有 `RuntimeExecutor`、执行契约、runtime context、DAG/state execution、manager event planning、expression evaluation 与 websocket event helper。

## 核心职责

- 解析 runtime DSL 并收集 dependencies。
- 跟踪 dependency changes，并通过 RuntimeExecutor API 规划 refresh/action execution。
- 从 runtime state 解析 template value。
- 注册并执行 runtime function。
- 创建与校验 websocket event payload。

## 与其他包关系

- 直接拥有 `ExecutionPlan`、`ExecutionNode`、`Expression`、`RuntimeContext`、runtime event 与 page topic 等执行契约。
- 从 `kernel` 消费 `ViewDefinition` 与 node definition 等结构契约。
- BFF websocket code 可以发布与这些 contract 兼容的 runtime event。
- 前端 runtime adapter 消费本包 contract，但不直连数据库或业务 API。
- Query node 通过 `query` 构建 AST，经过 `permission` AST transform 后编译 SQL，并通过共享 `datasource` adapter 契约执行。
- BFF 负责装配具体 datasource adapter；runtime 不读取 DB config，也不直接访问物理数据。
- Runtime 可以在 plan、node、permission、datasource 边界发出可选 audit observability event，但不改变执行语义。

## 最小闭环

```mermaid
flowchart LR
  View["Kernel ViewDefinition"] --> Executor["RuntimeExecutor"]
  Dsl["Runtime DSL"] --> Parser["runtime-dsl-parser"]
  Parser --> Executor
  Executor --> Event["WS event contract"]
  Event --> BFF["BFF websocket gateway"]
```

## 常用命令

```bash
pnpm --filter @zhongmiao/meta-lc-runtime build
pnpm --filter @zhongmiao/meta-lc-runtime test
```

## 边界约束

- RuntimeExecutor 是唯一执行引擎；禁止再新增 runtime orchestrator module。
- Runtime consumer 的数据访问仍必须经过 BFF contract。
- Runtime query execution 不能注入 SQL permission clause；必须在 SQL 编译前调用 permission AST transform。
- Runtime audit observer 必须保持可选、非阻塞；observer 失败不得影响 plan execution。
