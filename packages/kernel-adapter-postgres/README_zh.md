# @zhongmiao/meta-lc-kernel-adapter-postgres

[English](./README.md) | 中文文档

## 包定位

`kernel-adapter-postgres` 提供 kernel repository port 的 Postgres 实现。它是给 composition root 使用的实现包，不是核心平台基础包。

## Public API

```ts
import {
  PostgresMetaKernelRepositoryFactory,
  createPostgresMetaKernelRepository
} from "@zhongmiao/meta-lc-kernel-adapter-postgres";

const repository = createPostgresMetaKernelRepository(config);
const repositoryFromClassFactory = new PostgresMetaKernelRepositoryFactory().create(config);
```

函数式 factory 与 class factory 都是公开 composition API。包根入口只导出聚合 repository、这些 factory 与公开 migration execution context type。内部 SQL schema、mapper、row interface、pool util 与子 repository 都是实现细节。

## 边界约束

- 只依赖 `@zhongmiao/meta-lc-kernel` contract 与 `pg`。
- 不依赖 runtime、BFF、query、permission、datasource 或 audit。
- 只应由 app/example composition root 或 infra script 引入。
- interface、type、factory、class、mapper、schema 与 util 文件按语义后缀拆分。
