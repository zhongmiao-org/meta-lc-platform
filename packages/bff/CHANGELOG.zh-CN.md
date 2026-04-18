[English](CHANGELOG.md) | 中文文档

## [Unreleased]

- chore(package): 为 release 治理切换到 `@zhongmiao/meta-lc-bff` 正式包名。
- fix(local-dev): 将 BFF 本地默认端口调整为 `6001`，并显式绑定 host，避免浏览器因 unsafe port 策略阻断联调访问。

## 0.1.0 (2026-04-18)

- BFF query、mutation、bootstrap 与 audit 编排层的首个基线版本。
