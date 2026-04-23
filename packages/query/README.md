# @zhongmiao/meta-lc-query

English | [中文文档](./README_zh.md)

## Package Role

`query` compiles platform query DSL into SQL and parameter lists. It is a compiler package, not a database executor.

## Responsibilities

- Define query compiler input and output types.
- Convert table, fields, filters, and limit into safe SQL fragments.
- Keep SQL generation testable without a live database.

## Relationship With Other Packages

- `bff` calls query compilation before datasource execution.
- `permission` decisions can contribute filters or scope constraints before final query execution.
- `datasource` executes compiled SQL; `query` does not depend on `datasource`.
- `contracts` provides the API request shapes that BFF adapts into query compiler input.

## Minimal Flow

```mermaid
flowchart LR
  Request["QueryApiRequest"] --> BFF["BFF adapter"]
  BFF --> Compiler["QueryCompiler"]
  Compiler --> Sql["SQL + params"]
  Sql --> Executor["BFF datasource executor"]
```

## Commands

```bash
pnpm --filter @zhongmiao/meta-lc-query build
pnpm --filter @zhongmiao/meta-lc-query test
```

## Boundary Notes

- Do not open DB connections here.
- Keep permission policy resolution outside this package; consume already-resolved filters or constraints.
