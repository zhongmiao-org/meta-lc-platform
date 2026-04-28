# @zhongmiao/meta-lc-kernel-adapter-postgres

English | [中文文档](./README_zh.md)

## Package Role

`kernel-adapter-postgres` provides the Postgres implementation of the kernel repository port. It is an implementation package for composition roots, not a core platform package.

## Public API

```ts
import {
  PostgresMetaKernelRepositoryFactory,
  createPostgresMetaKernelRepository
} from "@zhongmiao/meta-lc-kernel-adapter-postgres";

const repository = createPostgresMetaKernelRepository(config);
const repositoryFromClassFactory = new PostgresMetaKernelRepositoryFactory().create(config);
```

The function factory and class factory are both public composition APIs. The package root exports only the aggregate repository, these factories, and the public migration execution context type. Internal SQL schema, mappers, row interfaces, pool utilities, and sub-repositories are implementation details.

## Boundary Notes

- Depends on `@zhongmiao/meta-lc-kernel` contracts and `pg`.
- Must not depend on runtime, BFF, query, permission, datasource, or audit.
- Should be imported only from app/example composition roots or infra scripts.
- Keep interface, type, factory, class, mapper, schema, and util files split by semantic suffix.
