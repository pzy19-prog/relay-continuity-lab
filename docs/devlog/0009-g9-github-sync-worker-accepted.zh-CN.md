# Devlog 0009：G9 GitHub Transport Sync Worker 验收

日期：2026-09-24

G9 的目标是消掉 Chat/Work → 本地 Relay 之间的一段手工 transport import，同时不让 GitHub comment 直接获得本地执行权。

## fresh pilot

Canonical task：

`R-G9-GITHUB-SYNC-001`

GitHub transport：

`chat-001 -> work-001`

实测结果：

- Node tests: 40/40 PASS
- smoke assertions: 10/10 PASS
- authenticated GitHub reader: `gh-authenticated`
- initial chat sync: PASS
- Work draft detected automatically: PASS
- Work packet auto-sealed: PASS
- Transport Inbox packet count: 2
- last accepted: `work-001`
- repeated sync: `IDEMPOTENT / changed=false`
- worker restart: PASS
- state drift: no
- manual transport-import command: no
- local coding task created: no
- code executed: no
- Service inbox: `VALIDATED`
- service-backed UI: PASS

## fail-closed defect

首轮 UI 启动暴露了 `src/web.mjs` parse error。Luna 在该点停止，没有继续伪造成功。

随后：

- 修复 UI 分支；
- 新增 `node --check src/web.mjs` 回归 gate；
- GitHub Actions #88 通过；
- 复用原 pilot/store 继续验证，无需重做 Work。

这个失败被保留为公开开发证据。

## Human-visible UI gate

人工截图确认：

- `Task Inbox (0)`
- `Transport Inbox (1)`
- task `R-G9-GITHUB-SYNC-001`
- status `VALIDATED`
- source `pzy19-prog/relay-continuity-lab#13`
- `Last: work-001 · seq 2`
- validated cloud lineage:
  - `#1 CHAT_INTENT: chat-001`
  - `#2 WORK_CONTINUATION: work-001`

因此 GitHub transport 的新增 Work draft 已能在无需人工 import 的情况下出现在本地 Service/UI。

## Authority boundary

G9 明确没有做：

- 自动创建本地 coding task
- 自动执行 Codex/Luna coding task
- receipt / verify / decide
- APPROVE / REJECT
- cloud-to-local tunnel
- remote Relay Service bind

下一步应该单独验证 Transport Inbox → Local Task 的**显式绑定/导入 gate**，而不是让 GitHub comment 静默产生本地执行任务。
