English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- feat(release): add aggregate package `@zhongmiao/meta-lc-platform` and reserve `@zhongmiao/meta-lc-*` naming for workspace packages.
- feat(ci): add changelog gate, release draft sync, and manual changelog finalize workflow for platform release governance.
- docs(changelog): establish bilingual root/package changelog baselines for the platform workspace.
- feat(runtime): add dependency graph planning so runtime state and mutation events can drive deterministic auto-refresh execution.
- feat(runtime): add a minimal rule engine and function registry so runtime events can compute rule-driven patches, actions, and datasource refreshes.
- docs(runtime): sync the runtime contract, frontend integration, migration guidance, and testing playbook to the current manager-first implementation.
- fix(boundaries): tighten direct `pg` access down to explicit BFF/datasource/kernel entry points and remove the audit package from the transitional DB-driver allowlist.
- fix(boundaries): promote DB-driver boundary checks from a transitional allowlist to explicit package/file policy checks with self-tests.

## 0.1.0 (2026-04-18)

- Initial internal baseline for the Meta-Driven middleware monorepo.
- Includes BFF runtime entry, query/mutation orchestration, audit persistence, migration bootstrap, and Phase 4 runtime parser/resolver bootstrap.
