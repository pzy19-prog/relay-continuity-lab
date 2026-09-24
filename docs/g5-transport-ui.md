# G5 — 减少人工 Transport 步骤 + UI Lineage

G4 已证明显式 `Chat -> Work -> Codex -> Chat` 可以在同一 canonical task ID 下闭环。G5 不改变安全边界，目标是减少 JSON/命令搬运。

## 新增组件

- `scripts/transport-adapter.mjs`：读取 GitHub Issue、校验 packet chain、验证 Work draft、封装 continuation、受保护发布、保存 snapshot。
- `scripts/g5-pilot-prepare.mjs`：单命令完成 Work draft → sealed continuation → GitHub publish → WSL synthetic pilot 创建。
- `scripts/g5-pilot-finish.mjs`：独立验证 Codex 结果、生成 receipt、更新 UI snapshot，并可显式发布 receipt。
- 本地只读 UI：显示 Chat / Work / Codex 的 packet lineage、surface、parent、evidence status。

## 安全规则

1. GitHub 发布默认 dry-run。
2. 只有显式 `--publish-work` / `--publish-receipt` 才调用本机已认证的 `gh`。
3. packet 发布前必须通过 schema/hash/lineage/privacy 校验。
4. 项目本地绝对路径、token/authorization/cookie/secret-like 内容禁止进入 public transport。
5. human-only scope change 和 final approval 不变。

## G5 实验

Work 完成 G5 transport Issue 的 draft 后，在 WSL：

```bash
cd ~/relay-continuity-lab
git pull --ff-only
npm test
gh --version
gh auth status
node scripts/g5-pilot-prepare.mjs --issue 6 --publish-work
```

如果 `gh` 未安装或未认证，发布会 fail closed；不要粘贴 Token。可先省略 `--publish-work` 查看 dry-run packet。

成功后脚本输出新的 `pilot_dir` / `repo` / `store` / canonical task ID。可同时启动 UI：

```bash
RELAY_STORE=<输出的 store> npm run ui
```

浏览器访问 `http://127.0.0.1:4317/?task=<task-id>`，应看到 transport lineage。

Codex 提交后：

```bash
node scripts/g5-pilot-finish.mjs <pilot_dir> --publish-receipt
```

随后 Chat 读取 GitHub receipt；最终仍由用户明确执行 `decide --decision APPROVE`。

## 当前非目标

- 不自动启动 Work 或 Codex 界面；
- 不同步隐藏聊天上下文；
- 不允许无人值守批准；
- GitHub 不是最终 Relay Service。
