# Relay Lab：本地任务连续性原型

[English](README.md) | **简体中文**

**状态：公开开发预览 / pre-alpha。仓库名称仅为工程占位名，正式产品品牌未确定；G2–G7 已完成逐步增强的本地与跨界面连续性实验；G7 已实测 loopback-only 的只读/状态 Relay Service API，并验证同一 G6 store 在服务停止/重启后仍保持相同 task、checkpoint 与 lineage。**

Relay Lab 验证不同 AI 使用界面之间的任务连续性。当前已经实现：单用户本地 Core、CLI、显式 transport packet、结构化 Receipt、Git / 文件哈希 / 独立测试校验、持久化恢复点、可安装项目级 Skill、受保护的 GitHub transport helper、可显示跨端 lineage 的**只读** Web UI，以及 loopback-only 的只读/状态 Relay Service API。它仍然不是 Chat/Work 隐藏会话同步，也不能让云端直接控制本机 WSL。

> 待验证的产品假设：跨 AI 界面保留正确的任务状态、约束与证据，无需反复粘贴完整对话；遇到过期环境或证据不足时明确阻断。

## 在 WSL 中进行第一个真实 Agent 人工交接

[详细操作说明](docs/wsl-pilot.zh-CN.md)包含隔离安装、生成合成任务、向本地 Agent 人工交接、采集回执、独立验证、人工批准的完整步骤。公开仓库建成后，在 WSL 运行：

```bash
git clone https://github.com/pzy19-prog/relay-continuity-lab.git
cd relay-continuity-lab
npm test
node scripts/pilot-prepare.mjs
```

只允许 Agent 访问脚本生成的**合成临时仓库**，不能复制真实私人仓库或密钥。执行器提交后使用 `node scripts/pilot-finish.mjs <脚本实际输出目录>` 校验，再人工审查决定是否通过。G2 已在用户 WSL 完成真实本地 Agent 的修改提交、独立校验、人工批准和独立进程恢复；G3 的真实 Skill 调用仍待验证。


## 离线运行（Node >=22、Git）

```bash
npm test
npm run relay -- list
node scripts/skill-pilot-prepare.mjs
# 从脚本输出中取得真实的 store 路径：
RELAY_STORE=/tmp/<实际生成目录>/state npm run ui
# 本机浏览器打开 http://127.0.0.1:4317
```

演示程序只操作新创建的、无敏感数据的临时 Git 仓。真实使用时，只能指向你已经信任的本地仓库和测试代码；独立校验会执行仓库测试，**不是恶意代码沙箱**。不需要云服务或付费模型。

CLI 操作示例：

```bash
node src/cli.mjs create --goal '修复计算错误' --repo /绝对路径/可信仓库 --actor local-executor --allowed src/calc.mjs --test src/calc.test.mjs
node src/cli.mjs handoff <任务ID>       # 只输出交接包，不自动派单
node src/cli.mjs receipt <任务ID> --file receipt.json
node src/cli.mjs verify <任务ID>        # Git HEAD、文件范围和哈希、独立测试
node src/cli.mjs decide <任务ID> --decision APPROVE  # 必须有明确的人工批准
node src/cli.mjs resume <任务ID>
node src/cli.mjs list
```

默认状态目录为 `~/.relay-lab-local/tasks/*.json`；可设置 `RELAY_STORE` 或 `--store <目录>` 隔离。不要将本地状态目录公开提交。交接包中可能含本机绝对路径，对外分享前必须脱敏。

## 实现结构

```text
Skill / CLI（人工交接）       Web 时间线（只读）
          \                    /
               Relay Core
               | Task、State、Events
               | Handoff、Receipt、独立验证
               | 人工决策、恢复点
               v
         本地 JSON 状态目录
               |
          可信临时 Git 仓库
```

当前使用 JSON 是为了实现无第三方依赖、可离线复现的**单进程研究原型**。SQLite、并发控制、权限、TypeScript 合约、真正的平台适配器及正式 PWA 安装均未实现。不支持不可信仓库执行，Web UI 只监听本机地址，且只读。

## 本轮已观察到的测试结果

本隔离执行环境中，**19/19 集成测试 + 10/10 原有设计断言通过**，新增针对提交后工作树污染、未跟踪文件、文件/测试符号链接的阻断回归用例。这不代表恶意代码安全审计、真实 Agent 接入成功，也不是竞品实测结果。

## 公开研究资料

- [G3 Skill 安装与 WSL 试点](docs/skill-pilot.zh-CN.md)；[G3 公开开发记录](docs/devlog/0003-installable-project-skill.zh-CN.md)。

- [首篇开发日志](docs/0000-why-we-are-building.md)：区分观察事实、待验证假设与宣传。
- [Skill](skills/relay/SKILL.md)：教会具备本地 CLI 权限的 Agent 使用本工具；不是自动互联能力。
- [产品路线](docs/roadmap-v0.1.md)：此前计划；实际完成程度以本 README 为准。


**由 PZY Nexus 孵化**（仅用于说明来源；产品独立可运行，不依赖 Nexus）。
## G3：安装并试用项目级 Skill

不再下载 ZIP，也不需要操作原 G2 的临时目录：

```bash
cd ~/relay-continuity-lab
git pull --ff-only
npm test
node scripts/skill-pilot-prepare.mjs
```

脚本会创建**全新合成仓库**，预先装好 `.agents/skills/relay-lab/`，并提交为 Git 基线。在 Cursor WSL 打开输出的 `demo-repo`，让真实 Agent 读取 `AGENT_TASK.md` 并**实际调用**项目 Skill 的 `show`、`resume`，然后仅修改并提交 `calc.mjs`。由独立的 `skill-pilot-finish.mjs` 进行验证，仍需要你人工批准。详见[完整中文指南](docs/skill-pilot.zh-CN.md)。

最近一次用户 WSL 的 G7 基线为 **35/35 Node 测试 + 10/10 合成断言通过**。Service 在 `127.0.0.1:4318` 启动，无需迁移即可读取已验收 G6 store；停止并重新启动后，task ID、`COMPLETED` 状态、owner、head、`environment_match=true`、`worktree_clean=true` 和三段 transport lineage 均保持一致。

## G4：Chat → Work → Codex 显式中转

G4 暂时使用专用 GitHub Issue 作为可审计 transport：Chat 发布封装后的意图包，Work 产生结构化 continuation draft，Chat 负责确定性校验和封装，WSL 再校验 packet chain 并以同一个 canonical task ID 创建本地 Relay 任务。详见 [G4 指南](docs/g4-chat-work-codex.md)。这不等于隐藏会话同步，也不是 Work 直接访问 WSL。

## G5：减少人工 transport 步骤

G5 已实现并实测本地 transport adapter：自动校验 Work draft、封装 `WORK_CONTINUATION`、仅在显式 flag 下通过已认证的 `gh` 发布、把 transport snapshot 与 Relay state 一起保存，并在只读 UI 中显示完整 packet lineage。一次真实合成 G5 任务已经经过人工批准和批准后 resume。详见 [G5 指南](docs/g5-transport-ui.md)。

## G6：统一 Demo 入口

G6 已实测 `npm run demo -- ...` 与 pilot-local `relay-demo` launcher，统一承载 `prepare`、`status`、`finish`、显式 `approve`、脱敏 `report` 和恢复提示。本轮 fresh run 真实记录 6 次统一 demo CLI 命令、0 次手工 JSON 复制；不为 G4/G5 事后杜撰精确点击/切换数量。详见 [G6 指南](docs/g6-unified-demo.md)。

## G7：本地 Relay Service/API

G7 已实测 loopback-only（`127.0.0.1`）只读/状态 API，包括 `health`、task detail 和 checkpoint。已验收 G6 JSON store 无需迁移即可直接服务；真实 WSL 停止/重启后，task ID、`COMPLETED` 状态、owner、head、`environment_match=true`、`worktree_clean=true` 以及完整 `CHAT_INTENT → WORK_CONTINUATION → EXECUTION_RECEIPT` lineage 均保持一致。该 Service 明确不开放远程 bind、CORS、cloud tunnel、provider credentials，也不允许 service-side 自动审批。详见 [G7 指南](docs/g7-local-service.md)。
