[English](CHANGELOG.md) | 中文文档

## [Unreleased]

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

## 0.1.0 (2026-04-18)

- BFF query、mutation、bootstrap 与 audit 编排层的首个基线版本。
