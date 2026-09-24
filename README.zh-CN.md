# Relay Lab：本地任务连续性原型

[English](README.md) | **简体中文**

**状态：公开开发预览 / pre-alpha。仓库名称仅为工程占位名，正式产品品牌未确定；G2 已完成真实本地 Agent 人工交接闭环；G3 已完成真实项目级 Skill 闭环；G4 已完成一次真实的显式 Chat → Work → Codex → Chat 连续性闭环；G5 正在减少人工 transport 步骤，并把跨端 packet lineage 显示到本地 UI。**

Relay Lab 验证不同 AI 使用界面之间的任务连续性。当前已经实现：单用户本地 Core、CLI、显式 transport packet、结构化 Receipt、Git / 文件哈希 / 独立测试校验、持久化恢复点、可安装项目级 Skill、受保护的 GitHub transport helper，以及可显示跨端 lineage 的**只读** Web UI。它仍然不是 Chat/Work 隐藏会话同步，也不能让云端直接控制本机 WSL。G4 已实测完成一次合成任务的 Chat → Work → Codex → Chat 显式闭环。

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

最近一次用户 WSL 的 G4 基线为 **25/25 Node 测试 + 10/10 合成断言通过**；随后真实完成了一次保持 canonical task ID 的 Chat → Work → Codex → Chat 闭环，并经过独立验证、人工批准和批准后 resume。G5 新增的 adapter/UI 代码尚待新一轮 WSL 测试。

## G4：Chat → Work → Codex 显式中转

G4 暂时使用专用 GitHub Issue 作为可审计 transport：Chat 发布封装后的意图包，Work 产生结构化 continuation draft，Chat 负责确定性校验和封装，WSL 再校验 packet chain 并以同一个 canonical task ID 创建本地 Relay 任务。详见 [G4 指南](docs/g4-chat-work-codex.md)。这不等于隐藏会话同步，也不是 Work 直接访问 WSL。

## G5：减少人工 transport 步骤

G5 新增本地 transport adapter：自动校验 Work draft、封装 `WORK_CONTINUATION`、可选择通过已认证的 `gh` 发布、把 transport snapshot 与 Relay state 一起保存，并在只读 UI 中显示完整 packet lineage。发布默认 dry-run，只有显式 `--publish-work` / `--publish-receipt` 才会写 GitHub。详见 [G5 指南](docs/g5-transport-ui.md)。
