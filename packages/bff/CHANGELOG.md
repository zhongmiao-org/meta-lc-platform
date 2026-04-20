English | [中文文档](CHANGELOG.zh-CN.md)

## [Unreleased]

- feat(gateway): add meta API, in-memory cache, aggregation summary, and WebSocket lifecycle baseline.
- feat(api-contracts): annotate query and mutation controller responses with shared API response contracts.
- chore(gateway): reuse the shared runtime page topic helper for WebSocket subscription acknowledgements.
- chore(package): adopt the `@zhongmiao/meta-lc-bff` scoped package identity for release governance.
- fix(local-dev): move the default BFF local port to `6001` and bind an explicit host so browser-based integration can reach the service without unsafe-port blocking.
- test(permission-gate): expand the query/mutation gate baseline to cover `SELF`, `DEPT_AND_CHILDREN`, and `CUSTOM_ORG_SET` permission paths in addition to the existing `DEPT` denied checks.
- feat(permission-seed): add custom-org and self-scope demo identities so org-scope policies can be exercised in e2e and remote bootstrap flows.
- feat(gateway): add a WebSocket emit baseline for runtime manager-executed updates.
- feat(gateway): add topic-room broadcast and in-memory replay for runtime manager-executed updates.
- feat(gateway): add a configurable runtime WebSocket replay store with a Redis-backed latest-event adapter.
- feat(gateway): add a configurable runtime WebSocket broadcast bus with Redis pub/sub fanout.
- feat(gateway): add runtime WebSocket operations status and health visibility.

## 0.1.0 (2026-04-18)

- Initial middleware orchestration baseline for BFF query, mutation, bootstrap, and audit flows.
