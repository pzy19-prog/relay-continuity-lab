# WSL 上的 Relay 隔离试点

当前状态：公开仓已经建立；尚未完成真实 Codex / Work / Chat 自动交接。首次 WSL 试点不需要下载 ZIP，直接克隆仓库。

## 1. 克隆与自测

```bash
cd ~
git clone https://github.com/pzy19-prog/relay-continuity-lab.git
cd relay-continuity-lab
node --version
git --version
npm test
```

要求 Node 22+。不要把私人仓库、Token、会话导出或密钥复制进试点目录。

## 2. 生成一次性合成任务

```bash
node scripts/pilot-prepare.mjs
```

输出 `pilot_dir`、`repo` 与 `handoff_file`。只让你明确授权的本地 Codex / Cursor Agent 打开输出的 `demo-repo`。

执行器约束：
- 只修改 `calc.mjs`
- 不修改测试
- 必须提交 Git commit
- 不需要 push、联网或读取任何私人项目

## 3. 收回结果并独立验证

执行器提交后：

```bash
node scripts/pilot-finish.mjs /tmp/relay-real-agent-pilot-<实际目录>
```

只有状态达到 `VERIFIED_PENDING_DECISION` 才进入人工审查。actor 字符串不是密码学身份认证，独立测试也不等于语义设计审查。

人工确认后再执行脚本打印出的 `decide ... --decision APPROVE` 命令。

## 4. 本轮目标

这次只验证：

`Task -> Handoff -> Real local Agent -> Git evidence -> Independent verify -> Human decision -> Resume`

不接触 PCT / Nexus / Forge 真实仓库，不把模拟或自报 PASS 当成真实证明。
