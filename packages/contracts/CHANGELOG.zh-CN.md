[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- docs(readme): 新增双语子包 README 与最小架构流程图。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-contracts` 正式包名。
- feat(runtime-contracts): 补充依赖图执行所需的刷新事件与目标契约类型。
- feat(runtime-contracts): 补充事件驱动规则求值所需的规则与函数契约类型。
- feat(runtime-contracts): 新增共享 runtime page topic helper，用于 BFF WebSocket 与 runtime orchestration 边界对齐。
- feat(api-contracts): 新增 query 与 mutation 响应契约，供生成的 API route manifest 引用。
- feat(runtime-contracts): 新增 manager-executed WebSocket 事件 envelope，用于 runtime 页面更新。
- feat(runtime-contracts): 为 runtime manager-executed 事件新增可选 replay cursor。

## 0.1.0 (2026-04-18)

- query、mutation、permission 与 runtime DSL 类型契约的首个基线版本。
