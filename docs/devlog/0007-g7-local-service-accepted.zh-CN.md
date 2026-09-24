# Devlog 0007：G7 本地 Relay Service/API 验收

日期：2026-09-24

G7 的目的不是让 Chat/Work 自动控制本机，而是验证：未来的 UI、CLI、Skill 和 provider/client adapter 是否可以共享一个稳定的本地接口，而不是分别理解 Relay 的 JSON 文件与内部实现。

## 实测对象

直接复用已经验收的 G6 store：

- task: `R-G6-CHATWORK-CODEX-001`
- final state: `COMPLETED`
- owner: `human`
- head: `73dd294d73123c916db62c76448049c01d430c62`
- independent review: `INDEPENDENT_CHECKS_PASS`

无需数据迁移。

## 实测结果

WSL 基线：

- Node tests: 35/35 PASS
- synthetic assertions: 10/10 PASS
- GitHub Actions G7 atomic commit: success

Service：

- bind: `127.0.0.1:4318`
- mode: read-only
- API: v1
- remote bind: refused by design
- CORS: not enabled
- non-GET: rejected

真实 query：

- `health`: PASS
- `show R-G6-CHATWORK-CODEX-001`: PASS
- `checkpoint R-G6-CHATWORK-CODEX-001`: PASS

返回值保持：

- task ID unchanged
- state = `COMPLETED`
- owner = `human`
- actual head = expected head
- `environment_match=true`
- `worktree_clean=true`
- lineage = `CHAT_INTENT → WORK_CONTINUATION → EXECUTION_RECEIPT`

## Restart durability

人工停止 Service 后，使用同一 `RELAY_STORE` 重新启动。

再次执行 show/checkpoint，以上字段全部一致，无状态漂移。

这证明当前 JSON store 可以继续作为 persistence spike，而 Relay Service 已能作为稳定 access boundary。

## 操作分工经验

这轮也验证了一个重要的人机分工：

- Chat/Sol：负责阶段判断、证据审查、gate 决策；
- 本地 Luna/Cursor Agent：适合执行确定性的 Bash、测试、启停 Service、query 和前后对比；
- 人：保留 scope change、APPROVE/REJECT 与高权限动作。

这能显著减少“手工切终端—复制命令—复制输出”的摩擦，同时不让本地 Agent 获得额外决策权。

## 当前边界

G7 仍然不是：

- Chat/Work hidden-session sync
- 云端到 WSL 的自动控制
- remote Relay Service
- multi-user auth
- provider credential broker
- service-side automatic approval

下一步适合做 thin adapters，使客户端依赖稳定 Service Contract，而不是直接依赖 JSON 文件或内部 CLI。
