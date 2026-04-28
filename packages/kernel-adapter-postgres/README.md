# @zhongmiao/meta-lc-kernel-adapter-postgres

English | [中文文档](./README_zh.md)

## Package Role

`kernel-adapter-postgres` provides the Postgres implementation of the kernel repository port. It is an implementation package for composition roots, not a core platform package.

## Public API

```ts
import { createPostgresMetaKernelRepository } from "@zhongmiao/meta-lc-kernel-adapter-postgres";
```

The package may export Postgres implementation classes and factories because its whole purpose is the kernel Postgres adapter surface.

## Boundary Notes

- Depends on `@zhongmiao/meta-lc-kernel` contracts and `pg`.
- Must not depend on runtime, BFF, query, permission, datasource, or audit.
- Should be imported only from app/example composition roots or infra scripts.
