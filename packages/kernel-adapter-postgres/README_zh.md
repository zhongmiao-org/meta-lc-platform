# @zhongmiao/meta-lc-kernel-adapter-postgres

[English](./README.md) | 中文文档

## 包定位

`kernel-adapter-postgres` 提供 kernel repository port 的 Postgres 实现。它是给 composition root 使用的实现包，不是核心平台基础包。

## Public API

```ts
import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";
```

该包可以导出 Postgres implementation class 与 factory，因为它本身就是 kernel Postgres adapter surface。

## 边界约束

- 只依赖 `@zhongmiao/meta-lc-kernel` contract 与 `pg`。
- 不依赖 runtime、BFF、query、permission、datasource 或 audit。
- 只应由 app/example composition root 或 infra script 引入。
