# Relay Lab status — historical snapshot index

**The 2026-09-23 snapshot below is historical, not the current repository status.** Its 13/13 count, uncompleted WSL/real-Agent gates and next steps describe the initial artifact-container package.

For the current implementation summary, see [English README](README.md#what-works-and-where-it-stops) / [中文 README](README.zh-CN.md#已实现什么停在哪里). For dated later observations, see [historical acceptance records](README.md#historical-acceptance-records) and the [2026-09-24 G10 acceptance devlog](docs/devlog/0010-g10-explicit-bind-accepted.zh-CN.md). The later recorded WSL baseline was 43/43 Node tests + 10/10 standalone synthetic smoke assertions; this documentation update does not claim a new run.

**以下保留 2026-09-23 原始历史快照。** 其中 13/13 测试和“尚未完成”的表述只适用于当时阶段；后续状态请看中英文 README 和带日期的开发日志。原始验收数字未改写为后来的结果。

---

# Relay Lab status — 2026-09-23 public repository initialized

**Status:** PUBLIC DEVELOPMENT PREVIEW / PRE-ALPHA. The engineering repository is public; the final product name is not selected. This does not constitute a stable release.

The isolated prototype package passed **13/13 Node integration tests and 10/10 synthetic gate assertions** in an artifact container. Public repository CI and clean-clone checks must be observed separately. This package has **not** been run in the user's WSL, used with a real Codex/Work/Chat Agent, or tested hands-on against installed competitor tools. Its instructional Skill has not been installed in a real Agent runtime.

Implemented in the isolated package: local single-user Core and JSON state, CLI, manual HandoffPacket, structured Receipt with Git/path/hash checks and an independently run trusted test, explicit human decision, persistence/resume, and read-only localhost UI. Automatic cross-surface transport is NOT implemented. Actor IDs are self-reported; local test execution is not an adversarial sandbox or semantic review.

**Next gates:** complete public code upload and clean GitHub CI; network-enabled WSL real local-Agent pilot on synthetic files; same-fixture competitor runs; full brand clearance before packaging the product as a named release.

This repository contains synthetic fixtures and sanitized public docs only. Do not upload private Nexus/PCT/Forge transcripts, absolute personal paths, tokens, or real Agent evidence to a public repository.
