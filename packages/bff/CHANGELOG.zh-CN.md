[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- refactor(datasource): BFF runtime view query 执行改为通过 datasource 包 adapter。
- fix(boundaries): 移除旧 `/query` 与 `/mutation` 编排入口，让 BFF 只作为 runtime gateway。
- test(gateway): e2e gate 从已移除的旧 query/mutation 入口改为验证 `POST /view/:name`。
- refactor(gateway): view 执行改为调用 runtime view facade，并把 Postgres runtime adapter 装配移入 infra。
- refactor(layering): 将 `src` 重建为严格的 controller/application/domain/infra/contracts 分层，把 runtime WebSocket 固定到 `controller/ws/runtime`，拆分 type/interface 文件，并用 ESLint 与 boundary check 固化规则。
- feat(gateway): 新增 `POST /view/:name`，并加入临时的 runtime-backed view adapter，让 BFF 的页面请求进入 runtime 执行链路。
- refactor(package-structure): 将 src 重整为 domain/application/infra/interface/types/utils 分层目录，并同步更新对外入口。
- docs(readme): 新增双语子包 README 与最小架构流程图。
- feat(gateway): 新增 meta API、内存 cache、aggregation summary 与 WebSocket lifecycle 基线。
- feat(api-contracts): 为 query 与 mutation controller 响应标注共享 API response contract。
- chore(gateway): WebSocket subscription acknowledgement 复用共享 runtime page topic helper。
- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-bff` 正式包名。
- fix(local-dev): 将 BFF 本地默认端口调整为 `6001`，并显式绑定 host，避免浏览器因 unsafe port 策略阻断联调访问。
- test(permission-gate): 将 query/mutation gate 扩展到 `SELF`、`DEPT_AND_CHILDREN`、`CUSTOM_ORG_SET` 权限路径，不再只覆盖现有 `DEPT` denied 样例。
- feat(permission-seed): 新增 custom-org 与 self-scope 演示身份，供 e2e 与远端 bootstrap 场景稳定复现组织域权限。
- feat(gateway): 新增 runtime manager-executed 更新的 WebSocket emit 基线。
- feat(gateway): 为 runtime manager-executed 更新新增 topic room 广播与内存 replay。
- feat(gateway): 新增可配置的 runtime WebSocket replay store 与 Redis latest-event adapter。
- feat(gateway): 新增可配置的 runtime WebSocket broadcast bus 与 Redis pub/sub fanout。
- feat(gateway): 新增 runtime WebSocket 运维状态与健康检查可见性。
- feat(gateway): 新增 runtime WebSocket 更新的 Redis Stream cursor replay。

## 0.1.0 (2026-04-18)

- BFF query、mutation、bootstrap 与 audit 编排层的首个基线版本。
