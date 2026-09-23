# Devlog 0004：第一次真实 Skill 调用失败——任务状态没有跟项目一起走

日期：2026-09-24

G3 第一次真实 Cursor Agent 试验并没有进入代码修改阶段。Agent 已发现项目内的 `relay-lab` Skill，并实际执行了 `show` / `resume`，但 CLI 默认读取 `~/.relay-lab-local`，而试点任务实际位于隔离的 `../relay-store`，因此返回 ENOENT。Agent 没有猜测另一个 store，也没有绕过 Relay 继续修改代码；后续控制器看到 `AGENT_COMMIT_MISSING`。

这暴露的是一个产品级问题：**仅安装 Skill 不等于任务连续性。项目还需要一个可发现、可审计的 task-state binding。**

修复采用项目根目录 `.relay-lab.json`：

```json
{"schema":1,"id":"relay-continuity-lab/project-binding","store":"../relay-store"}
```

项目级 Skill 在没有显式 `--store` / `RELAY_STORE` 时向上查找这个 binding，并解析同一 Relay store；没有 binding 时必须以 `PROJECT_STORE_UNBOUND` fail closed，禁止静默退回 home 默认 store。

修复后的隔离回归测试结果：20/20 Node tests + 10/10 synthetic assertions PASS。真实 Agent 重试仍待用户 WSL 验证，因此不能把本次修复描述为 G3 已完成。
