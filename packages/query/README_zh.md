# @zhongmiao/meta-lc-query

[English](./README.md) | 中文文档

## 包定位

`query` 将平台 Query DSL 编译成 SQL 与参数列表。它是 compiler 包，不是数据库执行器。

## 核心职责

- 定义 query compiler 的输入与输出类型。
- 将 table、fields、filters、limit 转成安全 SQL 片段。
- 保持 SQL 生成逻辑可在无数据库环境下测试。

## 与其他包关系

- `bff` 在 datasource 执行前调用 query compiler。
- `permission` 的决策可以在最终执行前贡献 filters 或数据域约束。
- `datasource` 执行编译后的 SQL；`query` 不依赖 `datasource`。
- `contracts` 提供 API request 形状，由 BFF 适配为 compiler input。

## 最小闭环

```mermaid
flowchart LR
  Request["QueryApiRequest"] --> BFF["BFF adapter"]
  BFF --> Compiler["QueryCompiler"]
  Compiler --> Sql["SQL + params"]
  Sql --> Executor["BFF datasource executor"]
```

## 常用命令

```bash
pnpm --filter @zhongmiao/meta-lc-query build
pnpm --filter @zhongmiao/meta-lc-query test
```

## 边界约束

- 不在这里打开数据库连接。
- 权限策略解析留在包外；本包消费已经解析好的 filters 或约束。
