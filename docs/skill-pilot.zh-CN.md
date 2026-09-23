# G3：Cursor WSL 项目级 Skill 首次真实调用试点

**状态：安装器与隔离模拟测试已在开发容器通过；用户 WSL 的真实 Agent 调用尚待确认。**

优先使用项目级 `.agents/skills/relay-lab/`，而不是修改全局环境。Cursor 官方文档说明该位置会自动发现，Codex 通常也支持该标准路径；具体以当前安装版本中能否看到 Skill 为准。

## 只需在 WSL 启动

在之前的公开仓库中：

```bash
cd ~/relay-continuity-lab
git pull --ff-only
npm test
node scripts/skill-pilot-prepare.mjs
```

脚本会在新的 `/tmp/relay-skill-pilot-.../demo-repo` 中，**先安装项目级 Skill 并提交为合成基线**，再调用安装后的 CLI 创建 Task 和 Handoff。这不改变你已有的 G2 试点、真实项目或 `~/.cursor/skills`。

在 Cursor WSL 中打开输出的 **demo-repo**，给 Agent 一句话：

> 阅读仓库 `AGENT_TASK.md` 和项目内的 `relay-lab` Skill；实际调用该 Skill 的 `show`、`resume` 命令读取 `../pilot.json` 中的任务状态；确认权限范围后修复并提交 `calc.mjs`，不要改测试或 Skill 文件，报告调用证据、提交和测试结果。

Agent 在其日志中必须实际展示对 `.agents/skills/relay-lab/scripts/relay.mjs` 的调用和返回状态。只引用 Skill 文字、不运行命令不算本轮「真实 Skill 调用」。若 Cursor 没有自动发现项目 Skill，先在设置中的 Skills 检查，**不要宣称已加载**。

## Agent 提交后

从之前公开仓库终端运行（将目录换成输出中的 `pilot_dir`）：

```bash
cd ~/relay-continuity-lab
node scripts/skill-pilot-finish.mjs '/tmp/relay-skill-pilot-实际目录'
```

需要 `VERIFIED_PENDING_DECISION` 且 `environment_match = true`。检查 Agent 运行证据和合成 Git diff 后，**你本人**再用输出给出的 `store`/`task_id` 调用安装在合成项目下的 CLI 做 `decide --decision APPROVE`，随后新建进程运行 `resume`。不自动批准、不重复派发 UNKNOWN 状态任务。

## 安装器供普通人试用

项目级（安装到明确批准的 Git 项目，不要直接安装进真实私有仓库）：

```bash
node scripts/install-skill.mjs --scope project --host cursor --project-dir /path/to/authorized/repo
node scripts/install-skill.mjs --scope project --host cursor --project-dir /path/to/authorized/repo --status
```

需要全局安装时才使用 `--scope user --host cursor`，会写入 `~/.cursor/skills/relay-lab`。`--uninstall` 只删除识别为本产品创建且未被自定义修改的 Skill；遇到已有/未知 Skill 默认拒绝覆盖。`--force` 是**明确允许覆盖已有的受管理安装**，不会覆盖未知目录。安装器不执行网络下载，不调用 AI，Skill 内部自带最小 Core + CLI 副本。

## 对照实验

G2 人工版和 G3 Skill 版用同样的加法缺陷合成 fixture；但 G2 未预先计时，因此不能根据聊天时间戳估算任务耗时，更不能宣称省了多少 Token。G3 首轮记录可观测的安装步骤、真实调用次数、用户人工拷贝次数、任务约束丢失与否、独立验证状态和恢复成功与否。真正要量化节省，需安排计时的同一机器、成对新任务重复试验。
