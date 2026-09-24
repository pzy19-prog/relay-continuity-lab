# Devlog 0010：G10 显式 Transport Inbox → Local Task 绑定验收

日期：2026-09-24

G10 的目标是把 G9 已同步的 cloud transport 与本地执行 authority 分开：GitHub transport 本身不能静默创建执行任务，必须经过一次明确的人类 bind。

## Fresh pilot

复用已验收的 public-safe G9 transport：

- source: `pzy19-prog/relay-continuity-lab#13`
- canonical task: `R-G9-GITHUB-SYNC-001`
- reviewed last packet: `work-001`

fresh local repo/store 中，bind 前：

- Transport Inbox: `VALIDATED`
- packet count: 2
- Local Task count: 0
- target repo clean

## Explicit bind result

Luna 执行 prepare 脚本打印出的 canonical bind command，一次人工授权后：

- status: `BOUND`
- created: true
- task ID preserved: `R-G9-GITHUB-SYNC-001`
- local task state: `CREATED`
- owner: `human`
- goal preserved: yes
- allowed paths preserved: `calc.mjs`
- test file preserved: `calc.test.mjs`
- constraints preserved: yes
- source provenance: Issue #13
- packet provenance: `work-001` + reviewed SHA-256
- local base provenance: exact pre-bind target repo HEAD

重复相同 bind：

- `IDEMPOTENT`
- created: false
- local task count remains 1
- provenance/base unchanged

## No implicit execution

整个 G10 pilot：

- no `HANDOFF_CREATED`
- no code execution
- no receipt
- no verify
- no decide
- no APPROVE / REJECT
- target repo HEAD unchanged
- target repo worktree clean
- no local source edit/commit/push

## Service/UI gate

人工截图确认：

- `Task Inbox (1)`
- local task `R-G9-GITHUB-SYNC-001` = `CREATED`
- owner = `human`
- `Transport Inbox (1)`
- same canonical task = `VALIDATED`
- `Local binding: BOUND · CREATED`
- validated cloud lineage remains `chat-001 -> work-001`

因此 Relay 现在把两个生命周期明确分离：

`Cloud transport synced` != `Local task authorized`

只有 explicit bind 才跨越这个边界；bind 后仍不会自动交给 executor。

## Next boundary

下一阶段应验证：

`CREATED bound local task -> explicit executor handoff -> local Agent`

必须继续保持 human-authorized handoff，不应因为 task 已绑定就自动启动 Codex/Luna。
