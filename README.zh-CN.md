# Relay Lab：本地任务连续性原型

[English](README.md) | **简体中文**

切换 AI 工具接续任务时，人往往要重新解释背景、重建状态，再核对“已完成”是否符合实际结果。Relay Lab 用显式交接包和本地恢复点保存任务身份、约束与交付证据，让接手方能检查这些信息，并在证据或环境不一致时停下来。

**公开开发预览 / pre-alpha：本地、单用户、单进程实验。** 仓库名称仅为工程占位名，不代表正式产品品牌或稳定发布。最近记录的里程碑是 2026-09-24 验收的 [G10 显式绑定](docs/devlog/0010-g10-explicit-bind-accepted.zh-CN.md)。

## 已实现什么，停在哪里

| 已实现 | 本仓库尚未实现 |
| --- | --- |
| 本地 Core/CLI、结构化交接包与回执、项目级 Skill、持久化恢复点 | Chat/Work/Codex 隐藏会话同步、Chat/Work 直接控制 WSL、通用自主执行器 |
| 独立检查 Git、task/actor/base/head、改动路径、文件哈希和指定测试 | 语义正确性保证、强 actor/human 身份认证、签名证据、不可信代码沙箱 |
| 本机回环地址上的只读 Web 时间线和 Relay Service API | 远程 Service 访问、服务端审批、多用户权限、并发写保护 |
| 受限 GitHub Issue transport 同步到独立 Transport Inbox，再显式绑定本地任务 | G10 绑定后自动交接执行器、写代码、提交回执、验证或批准 |

这些边界只描述本公开 Lab，不用于判断其他 PZY 组件的能力。actor/human 字段是流程约定，哈希不是签名；JSON 持久化是没有并发写保护的单用户、单进程实验。

## 一个任务，两条分开的路径

以受控的计算器任务为例：人交出只允许修改 `calc.mjs` 的任务，已授权的本地 Agent 提交修复，Relay 对照 Git、文件证据和未改动的测试检查回执，再由人审查决定；中断后，另一个进程读取恢复点。这是包含明确人工步骤的合成试点。

```text
可选 GitHub transport 路径（G9/G10）：
GitHub Issue -> 已验证的 Transport Inbox
             -> 显式人工授权 bind -> 本地任务：CREATED
                                          [停在 handoff 之前]

本地执行路径：
本地任务 -> 显式 handoff -> 已授权本地 Agent -> receipt
         -> 独立 verify -> VERIFIED_PENDING_DECISION
         -> 人工显式 APPROVE / REJECT -> checkpoint / resume
```

G10 保留同一个任务 ID、范围、测试、约束，以及来源数据包和本地基线的 provenance。绑定不会启动执行；`handoff` 只生成交接包，不自动派单。`verify` 成功后进入 `VERIFIED_PENDING_DECISION`，之后的 `decide` 是单独的人工动作。`UNKNOWN` 回执停在 `WAITING_RECONCILIATION` 等待核查；这是安全停止，不是自动恢复运行时。

## 离线合成试用

要求：**Node >=22、Git**。以下命令使用 Ubuntu/WSL 的 Bash。取得源码后，检查可离线运行，无需云账户、模型或 Agent，也不需要安装依赖。只有可选 GitHub transport 指南需要已认证的 `gh`。

**只运行你已经信任的仓库和测试。** 独立检查会执行仓库代码，Relay 不是恶意代码沙箱。

```bash
git clone https://github.com/pzy19-prog/relay-continuity-lab.git
cd relay-continuity-lab
npm test
```

`npm test` 先运行 Node 测试集，再在临时合成 Git fixture 上运行 `benchmark/smoke.mjs`。它验证受控示例，不会启动真实 coding Agent。smoke 脚本有自己的独立合成校验器，其 10 条断言不能视为 10 条生产 Core 端到端测试。

要观察持久化任务并让真实本地 coding Agent 执行，请单独使用 [WSL 试点](docs/wsl-pilot.zh-CN.md)或[项目 Skill 试点](docs/skill-pilot.zh-CN.md)。[G6 操作指南](docs/g6-unified-demo.md)介绍显式 transport demo；[G8](docs/g8-service-backed-adapters.md)介绍通过 Service 读取状态的 UI/Skill。早期指南保留原阶段的状态措辞；后续观察以以下带日期的记录为准。

本地状态默认保存在 `~/.relay-lab-local/tasks/*.json`，可用 `RELAY_STORE` 或 `--store <path>` 隔离。不要公开提交本地状态；数据包可能包含本机绝对路径，对外分享前先脱敏。

## 历史验收记录

以下是已有的观察记录，**不表示本次文档更新重新跑过这些检查**。

| 记录及出处 | 观察与范围 |
| --- | --- |
| 2026-09-23 [初始 STATUS 快照](STATUS.md) | artifact container 中 13/13 Node 集成测试 + 10/10 合成断言；当时 WSL/真实 Agent gate 尚未完成 |
| G10 之前的[中文 README 快照](https://github.com/pzy19-prog/relay-continuity-lab/blob/4549783c8573379574ca42df3ed4798bfff7443a/README.zh-CN.md) | 保留了更早隔离环境的 19/19 + 10/10 结果，未单独注明运行日期；不是后来的 G10 基线 |
| 2026-09-24 [G10 时期 README 记录](https://github.com/pzy19-prog/relay-continuity-lab/blob/4549783c8573379574ca42df3ed4798bfff7443a/README.md#observed-local-checks) | 用户观察到的 WSL 基线：43/43 Node 测试 + 10/10 独立合成 smoke 断言 |
| 2026-09-24 [G10 试点日志](docs/devlog/0010-g10-explicit-bind-accepted.zh-CN.md) | 一次显式 bind 只创建一个 `CREATED` 任务，重复相同绑定幂等；没有 handoff、代码执行、receipt、verify 或 decision |

G10 测试数字来自链接的 README 记录，试点日志记录绑定行为。两者都不是生产基准、对抗性安全审计或竞品实测。

## 里程碑与详细指南

| 阶段 | 公开记录 / 指南 |
| --- | --- |
| G2：人工交接给本地 Agent | [WSL 试点](docs/wsl-pilot.zh-CN.md)；[G3 日志](docs/devlog/0003-installable-project-skill.zh-CN.md)记录了此前 G2 结果 |
| G3：项目 Skill 与任务状态绑定 | [安装说明](docs/skill-pilot.zh-CN.md)、[早期待验证 gate](docs/devlog/0003-installable-project-skill.zh-CN.md)、[首次真实调用因 store 绑定失败](docs/devlog/0004-first-skill-binding-failure.zh-CN.md) |
| G4/G5：显式跨界面闭环与 transport helper | [G4 指南](docs/g4-chat-work-codex.md)、[G5 指南](docs/g5-transport-ui.md)、[G4 记录的真实本地 Codex Skill 执行](docs/devlog/0005-first-cross-surface-loop.zh-CN.md) |
| G6：统一 demo 入口 | [指南](docs/g6-unified-demo.md)、[验收与实测命令数](docs/devlog/0006-g6-unified-demo-accepted.zh-CN.md) |
| G7/G8：本地 Service 与只读客户端 | [G7 指南](docs/g7-local-service.md)、[G7 验收](docs/devlog/0007-g7-local-service-accepted.zh-CN.md)、[G8 指南](docs/g8-service-backed-adapters.md)、[G8 验收](docs/devlog/0008-g8-service-backed-adapters-accepted.zh-CN.md) |
| G9：受限 transport 同步 | [指南](docs/g9-transport-sync-worker.md)、[验收](docs/devlog/0009-g9-github-sync-worker-accepted.zh-CN.md) |
| G10：显式 bind，停在 `CREATED` | [指南](docs/g10-transport-bind.md)、[验收](docs/devlog/0010-g10-explicit-bind-accepted.zh-CN.md) |

早期“Skill 调用待验证”描述的是当时 gate；后来的 G4 日志已记录真实本地 Codex Skill 执行，不能把它们当作同时存在的当前状态。

## 研究与交流

可从[为什么做这个实验](docs/0000-why-we-are-building.md)、[Skill 说明](skills/relay/SKILL.md)和[路线图](docs/roadmap-v0.1.md)开始。路线图是此前计划，实际实现状态以本 README 和带日期的开发日志为准。问题与可复现观察可通过 [GitHub Issues](https://github.com/pzy19-prog/relay-continuity-lab/issues)交流，只分享合成、脱敏后的证据。

**名称仍是占位，品牌未核验。由 PZY Nexus 孵化**（仅说明来源；可独立使用，不是运行时依赖）。采用 [MIT 许可](LICENSE)，许可不代表产品已就绪。
