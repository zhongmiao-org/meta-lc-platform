# @zhongmiao/meta-lc-permission

[English](./README.md) | 中文文档

## 包定位

`permission` 负责评估角色与组织数据域策略，并在 SQL 编译前转换 query AST。它不拼接 SQL 字符串，也不执行 datasource。

## 核心职责

- 建模 role data policy 与 organization scope context。
- 解析 `SELF`、`DEPT`、`DEPT_AND_CHILDREN`、`CUSTOM_ORG_SET`、`TENANT_ALL` 等数据域。
- 返回 allowed organization ids、fallback flags 与 reason text。
- 在 query compiler 渲染 SQL 前，为 `SelectQueryAst` 加入 tenant、self 与 org-scope predicates。

## 与其他包关系

- `bff` 加载 user/org/policy context 后传入 runtime execution。
- `runtime` 在调用 query compiler 前执行 permission transform。
- `query` 将 permission-transformed AST 编译为 SQL 与 params。
- `contracts` 包含 API 边界共享的数据域 DTO。
- `audit` 可通过 BFF integration 记录 allow/deny 结果。

## 最小闭环

```mermaid
flowchart LR
  Context["OrgScopeContext"] --> Engine["PermissionEngine"]
  Engine --> Decision["DataScopeDecision"]
  Decision --> Transform["Permission AST Transform"]
  Transform --> Query["Query AST Compiler"]
  Query --> Audit["audit outcome"]
```

## 常用命令

```bash
pnpm --filter @zhongmiao/meta-lc-permission build
pnpm --filter @zhongmiao/meta-lc-permission test
```

## 边界约束

- 保持 policy evaluation 确定性。
- 不在此包中直接读取 users、roles 或 organization data；上下文由 BFF integration 提供。
- 不在此包拼接 SQL clause；权限必须通过 AST predicate 流转。
