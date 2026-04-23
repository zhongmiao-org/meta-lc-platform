# @zhongmiao/meta-lc-migration

[English](./README.md) | 中文文档

## 包定位

`migration` 是 kernel migration DSL 编译与 migration safety check 的轻量 facade。它提供 compile/apply helper，但不拥有 schema version storage。

## 核心职责

- 委托 kernel 将 `MigrationDslV1` 编译成 SQL bundle。
- 通过注入的 executor 执行 SQL statement。
- 在执行前强制 destructive statement check。
- 将 migration target 标记为 `meta`、`business` 或 `audit`。

## 与其他包关系

- 依赖 `kernel` 获取 migration DSL 类型、SQL 编译与 safety check。
- BFF 或 infrastructure code 提供实际 SQL executor。
- 不负责 Postgres connection setup；执行能力保持注入。

## 最小闭环

```mermaid
flowchart LR
  Dsl["MigrationDslV1"] --> Compile["compileToSql"]
  Compile --> Sql["up/down SQL"]
  Sql --> Safety["assertMigrationSafety"]
  Safety --> Apply["apply with injected executor"]
```

## 常用命令

```bash
pnpm --filter @zhongmiao/meta-lc-migration build
pnpm --filter @zhongmiao/meta-lc-migration test
```

## 边界约束

- 本包保持编排胶水定位，不成为 metadata repository。
- apply statements 时不能绕过 safety checks。
