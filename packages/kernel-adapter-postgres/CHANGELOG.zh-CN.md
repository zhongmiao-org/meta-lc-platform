[English](CHANGELOG.md) | 中文文档

## [Unreleased]

## 0.2.0-beta.0 (2026-04-28)

- chore(package): 将 Postgres kernel adapter 的 `pg` 调整为 optional peer dependency。
- feat(factory): 新增 class-based Postgres MetaKernel repository factory，实现 kernel contract。
- refactor(package): 将 Postgres repository 实现拆成 repository、factory、schema、mapper、interface、type 与 utility 模块，同时不扩大 public API。
- chore(package): 采用 kernel-adapter-postgres 包名，明确它只承载 kernel Postgres repository adapter。
- chore(package): 为承载 Postgres MetaKernel repository 实现的 kernel-adapter-postgres 包补充 changelog 基线。

## 0.1.0 (2026-04-18)

- 私有持久化集成包的首个基线版本。
