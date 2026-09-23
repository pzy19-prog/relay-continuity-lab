# G3：Cursor WSL 项目级 Skill 首次真实调用试点

**状态：安装器与隔离模拟测试已在开发容器通过；用户 WSL 的真实 Agent 调用尚待确认。**

优先使用项目级 `.agents/skills/relay-lab/`，而不是修改全局环境。具体是否被当前 Agent 自动发现，以实际运行证据为准。

## 只需在 WSL 启动

在公开仓库中：

```bash
cd ~/relay-continuity-lab
git pull --ff-only
npm test
node scripts/skill-pilot-prepare.mjs
```

脚本会在新的 `/tmp/relay-skill-pilot-.../demo-repo` 中，安装项目级 Skill，并在基线提交里加入一个 `.relay-lab.json`。它只绑定当前合成项目对应的隔离 Relay store，不需要 Agent 人工猜测或复制 `--store` 路径。

在 Cursor WSL 中打开输出的 **demo-repo**，给 Agent 一句话：

> 阅读仓库 `AGENT_TASK.md` 和项目内的 `relay-lab` Skill；实际调用该 Skill 的 `show`、`resume` 命令读取 `../pilot.json` 中的任务 ID；项目根目录的 `.relay-lab.json` 会自动绑定这次试点的隔离 store，不需要人工复制 `--store`；确认权限范围后修复并提交 `calc.mjs`，不要改测试或 Skill 文件，报告调用证据、提交和测试结果。

Agent 在其日志中必须实际展示对 `.agents/skills/relay-lab/scripts/relay.mjs` 的调用和返回状态。只引用 Skill 文字、不运行命令不算本轮「真实 Skill 调用」。如果项目 binding 缺失，Skill 应以 `PROJECT_STORE_UNBOUND` 停止，不能静默读取 home 下的默认 store。

## Agent 提交后

从公开仓库终端运行（将目录换成输出中的 `pilot_dir`）：

```bash
cd ~/relay-continuity-lab
node scripts/skill-pilot-finish.mjs '/tmp/relay-skill-pilot-实际目录'
```

需要 `VERIFIED_PENDING_DECISION` 且 `environment_match = true`。检查 Agent 运行证据和合成 Git diff 后，**你本人**再用输出给出的 `store`/`task_id` 做 `decide --decision APPROVE`，随后新建进程运行 `resume`。不自动批准、不重复派发 UNKNOWN 状态任务。

## 安装器供普通人试用

项目级安装：

```bash
node scripts/install-skill.mjs --scope project --host cursor --project-dir /path/to/authorized/repo
node scripts/install-skill.mjs --scope project --host cursor --project-dir /path/to/authorized/repo --status
```

安装器只负责 Skill 文件。Relay controller 应在已授权项目根目录提供受控的 `.relay-lab.json` binding，或显式传入 `--store` / `RELAY_STORE`。项目级 Skill 在没有这些绑定时必须 fail closed。

需要全局安装时才使用 `--scope user --host cursor`。安装器不执行网络下载，不调用 AI，Skill 内部自带最小 Core + CLI 副本。

## 对照实验

G2 人工版和 G3 Skill 版使用同类型的加法缺陷合成 fixture。G2 未预先计时，因此不能根据聊天时间戳估算节省时间或 Token。G3 首轮只记录可观测的安装步骤、真实调用次数、人工拷贝次数、约束是否丢失、独立验证状态与恢复结果。
