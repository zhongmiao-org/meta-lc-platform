[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- fix(ci): 在收窄 package public export 后，让 orders demo query gate 改为使用已构建的包入口运行。
- chore(public-api): 将 kernel、query、permission package root export 收窄为明确的 SDK-facing 符号。
- docs(topology): 在 package dependency topology 旁补充 runtime execution handoff 图。
- fix(boundaries): 移除 BFF 残留 kernel package 依赖，并明确 meta registry 只能通过 provider 注入访问。
- docs(topology): 基于 manifest 与生产源码 import 重新生成 package dependency topology。
- chore(examples): 将 orders demo metadata、SQL seed 与 mutation adapter 从核心包抽离到 `examples/orders-demo`。
- docs(readme): 同步最终架构协作流、子包上下游关系与编译/执行边界口径。
- fix(ci): 在 package-local test 前先构建 workspace 依赖，确保 clean CI runner 能解析各包入口。
- chore(boundaries): 通过 Nx module-boundary tags、全仓 ESLint 与硬边界检查锁死最终依赖规则，防止 kernel/query/datasource/audit 引入 workspace 依赖。
- chore(boundaries): 通过更严格的 BFF gateway 目录、runtime 入口命名、datasource demo adapter 命名与依赖守护，封板最终七包拓扑。
- refactor(boundaries): 锁定最终 runtime gateway topology，移除 BFF 数据装配，把执行依赖迁入 runtime，并禁止 kernel 反向依赖 runtime。
- refactor(architecture): 通过移除 BFF application 编排、runtime orchestrator 残留与 migration package，完成 runtime、kernel、BFF、migration 边界最终收敛。
- refactor(packages): 删除 contracts、shared、platform 过渡包，收敛到最终包拓扑。
- feat(audit): 新增非阻塞 runtime observability event，并在 BFF 持久化 plan、node、permission、datasource execution 事件。
- feat(kernel): 新增覆盖 view、datasource 与 permission policy 定义的版本化 meta definition registry。
- feat(permission): 新增 Query AST permission transform，并让 runtime query 编译链路先经过权限 AST。
- feat(datasource): 将 runtime query 执行收敛到共享 datasource adapter 契约。
- fix(boundaries): 收口 Task 1-9 runtime 边界遗漏，移除旧 BFF query/mutation 编排并新增防回归边界守护。
- feat(runtime): 新增面向 BFF gateway 集成的高层 runtime view executor facade。
- feat(contracts): 将 V2 ViewDefinition、ExecutionPlan 与 node 契约迁入共享 contracts 包。
- refactor(bff): 强制 BFF 严格分层，固定 controller/http/ws/cli 入口，拆分 type/interface 契约，并新增 ESLint 与 boundary 守护。
- feat(bff): 新增 `POST /view/:name` gateway，并接入临时的 runtime-backed adapter，让页面请求进入 runtime 执行链路。
- fix(runtime): 将 runtime 包入口对齐到重构后的 `dist/runtime/src` 输出，确保下游包在运行时可正确解析。
- refactor(package-structure): 将工作区包重整为 domain/application/infra/interface/types/utils 分层目录，并同步刷新边界检查。
- feat(runtime): 新增 RuntimeExecutor 主执行引擎，负责 DAG 分层调度、原子提交 state snapshot 并解析最终 view model。
- feat(runtime): 新增 QueryExecutor 适配层，负责编译 query 节点并执行 datasource 查询。
- docs(readme): 新增双语子包 README 索引与架构流程图。
- feat(release): 新增聚合总包 `@zhongmiao/meta-lc-platform`，并为工作区包统一预留 `@zhongmiao/meta-lc-*` 命名。
- feat(ci): 新增 changelog gate、release draft 同步与手动 changelog finalize 工作流，补齐平台发版治理基础。
- docs(changelog): 为平台工作区建立根级与包级双语 changelog 基线。
- feat(runtime): 新增依赖图规划能力，让 runtime 可由 state 与 mutation 事件驱动确定性自动刷新执行。
- feat(runtime): 新增最小 RuleEngine 与 FunctionRegistry，让 runtime 事件可计算规则驱动的 state patch、action 与 datasource refresh。
- docs(runtime): 将 runtime contract、前端接入、迁移指引与测试手册同步到当前 manager-first 实现口径。
- fix(boundaries): 将 `pg` 直连点收紧到显式的 BFF/datasource/kernel 入口，并把 audit 包移出过渡白名单。
- fix(boundaries): 将 DB driver 边界检查从过渡白名单升级为显式包/文件策略检查，并补充自测。
- feat(bff): 新增首版 Gateway 基线，覆盖 meta API、内存 cache、aggregation summary 与 WebSocket lifecycle smoke。
- feat(runtime): 新增 manager-first runtime orchestrator 基线与共享 runtime page topic helper。
- feat(kernel): 新增 SQL Generator V1 基线，覆盖 table、index、relation 与 compiler fixture。
- test(kernel): 将 SQL generator 示例提升为可复用的 compiler contract fixture 基线。
- feat(kernel): 新增 API Generator V1 route manifest 基线，并将 compiler fixture 扩展到 SQL 与 API 输出。
- feat(contracts): 新增 query 与 mutation 响应契约，供生成的 API route manifest 引用。
- feat(kernel): 新增 Permission Generator V1 manifest 基线，完成 SQL、API 与 permission 输出的 compiler fixture 覆盖。
- feat(kernel): 将 tenant、app、rule 与 permission 元数据纳入可版本化 MetaSchema 契约。
- feat(runtime): 新增 manager adapter 执行契约，用于执行 orchestrator command plan。
- feat(runtime): 新增 Runtime WebSocket manager-executed 事件契约与 BFF emit 基线。
- feat(bff): 新增 Runtime WebSocket topic room 广播与内存 replay 基线。
- feat(bff): 新增可配置的 Runtime WebSocket replay store 与 Redis latest-event adapter。
- feat(bff): 新增可配置的 Runtime WebSocket broadcast bus 与 Redis pub/sub fanout。
- feat(bff): 新增 Runtime WebSocket 运维状态与健康检查可见性。
- feat(bff): 新增 Runtime WebSocket 更新的 Redis Stream cursor replay。

## 0.1.0 (2026-04-18)

- Meta-Driven middleware monorepo 的首个内部基线版本。
- 包含 BFF 运行入口、query/mutation 编排、审计落盘、migration bootstrap，以及 Phase 4 runtime parser/resolver 起步能力。
